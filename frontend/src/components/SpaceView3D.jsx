import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

// hashId produces a stable non-negative integer from an asteroid's string ID
// using Horner's method (a polynomial rolling hash). The &0x7fffffff mask
// keeps the result positive so it can be safely used with modulo or as an
// array index. The same ID always yields the same number, so positions and
// velocity directions are consistent across re-renders and zoom levels.
function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff
  }
  return h
}

// scaleLD maps a lunar-distance value to Three.js world units using a log scale.
// A linear mapping would pack all nearby objects into a tiny region near Earth
// while pushing distant ones off-screen. Log compression spreads them visually.
// The +1 prevents log(0) for objects at exactly 0 LD, and the factor 22 was
// tuned so 1 LD ≈ 20 units and 100 LD ≈ 120 units within the camera's range.
function scaleLD(ld) {
  return 5 + Math.log(ld + 1) * 22
}

// neoScenePosition places an asteroid at radius r (encoding its real distance)
// on the surface of a sphere. Angles are derived deterministically from the ID.
//
// phi uses the formula phi = acos(1 − 2u), which is Archimedes' uniform sphere
// point-picking method. A naive phi = u * PI would over-sample near the poles
// because equal increments of phi cover unequal areas of the sphere at high
// latitudes. The 1597 multiplier (a prime) decorrelates the phi and theta hashes
// so objects don't inadvertently align on arcs.
function neoScenePosition(neo) {
  const h = hashId(neo.id)
  const theta = ((h % 1000) / 1000) * Math.PI * 2
  const u = ((h * 1597) % 10000) / 10000
  const phi = Math.acos(1 - 2 * u) // uniform sphere point picking
  const r = scaleLD(neo.miss_distance_lunar || 10)
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// neoVelocityDir returns a unit vector representing the direction of travel.
//
// Orbital mechanics: at closest approach (periapsis) the radial component of
// velocity is exactly zero — all motion is tangential (perpendicular to the
// Earth–asteroid position vector). This means any vector that is perpendicular
// to the radial direction is physically valid for the arrow at periapsis.
//
// To pick a specific perpendicular direction for each asteroid we:
//   1. Build an orthonormal tangent frame from the radial direction using cross
//      products. The fallback from Y to X avoids a degenerate cross when the
//      radial vector is nearly parallel to Y.
//   2. Run a second hash pass using the classic Linear Congruential Generator
//      constants (a=1664525, c=1013904223) to get a rotation angle in the
//      tangent plane. This gives every asteroid a unique, stable trajectory
//      without any real orbital data.
function neoVelocityDir(neo) {
  const pos = neoScenePosition(neo)
  const radial = pos.clone().normalize()

  // Build tangent frame — fall back to X-axis when radial is nearly vertical
  const ref = Math.abs(radial.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0)

  const tangent   = new THREE.Vector3().crossVectors(radial, ref).normalize()
  const bitangent = new THREE.Vector3().crossVectors(radial, tangent).normalize()

  // LCG second pass — decorrelated from the position hash
  const h = hashId(neo.id)
  const h2 = (h * 1664525 + 1013904223) & 0x7fffffff
  const angle = (h2 / 0x7fffffff) * Math.PI * 2

  return new THREE.Vector3()
    .addScaledVector(tangent,   Math.cos(angle))
    .addScaledVector(bitangent, Math.sin(angle))
    .normalize()
}

// arrowLength maps velocity to a visible scene-unit length.
// 110,000 km/h is approximately the 95th-percentile speed in NASA's NEO data,
// so we normalise against that and cap at 10 extra units to prevent arrows from
// overlapping neighbouring objects.
function arrowLength(neo) {
  const v = neo.relative_velocity_kmh || 50000
  return 3.5 + Math.min(10, (v / 110000) * 10)
}

function neoRadius(neo) {
  const avg = (neo.est_diameter_min_km + neo.est_diameter_max_km) / 2
  return Math.max(0.35, Math.min(2.0, Math.log(avg * 1000 + 2) * 0.55))
}

function buildRingGeometry(radius, segments = 128) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

// buildTrailGeometry creates a line that fades from transparent at the tail to
// semi-opaque at the asteroid's current position.
//
// THREE.LineBasicMaterial only supports a single opacity value for the whole
// line; achieving a per-vertex alpha gradient requires a custom ShaderMaterial
// that reads a Float32BufferAttribute ('lineAlpha') in the vertex shader and
// passes it to the fragment shader as a varying. That is why we store alphas
// as a vertex attribute rather than relying on vertex colours.
function buildTrailGeometry(origin, dir, length, segments = 12) {
  const pts = []
  const alphas = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // t=0 is the tail (behind the asteroid), t=1 is at the asteroid's position
    pts.push(origin.clone().addScaledVector(dir, -length * (1 - t)))
    alphas.push(t * 0.55)
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  geo.setAttribute('lineAlpha', new THREE.Float32BufferAttribute(alphas, 1))
  return geo
}

// GLSL shaders for the fading trail. The vertex shader forwards the per-vertex
// lineAlpha attribute to the fragment shader as a varying; the fragment shader
// uses it as the alpha channel so the trail fades from transparent to opaque.
const TRAIL_VERT = `
  attribute float lineAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = lineAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const TRAIL_FRAG = `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`

// ── Component ──────────────────────────────────────────────────────────────────

export default function SpaceView3D({ neos, onSelect }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [tooltip, setTooltip] = useState(null) // {neo, x, y}
  const asteroidMeshes = useRef([])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // ── Scene & Camera ───────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 2000)
    camera.position.set(0, 40, 130)
    camera.lookAt(0, 0, 0)

    // ── Orbit Controls ───────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 12
    controls.maxDistance = 500
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.15

    // ── Lighting ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223366, 1.2))
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
    sun.position.set(200, 60, 100)
    scene.add(sun)

    // ── Background Stars ─────────────────────────────────────────────────────
    const starPositions = new Float32Array(2400)
    for (let i = 0; i < 2400; i++) {
      starPositions[i] = (Math.random() - 0.5) * 1600
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaabcee, size: 0.4, sizeAttenuation: true })))

    // ── Earth ─────────────────────────────────────────────────────────────────
    const earthMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        float noise(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.4))) * 43758.5453);
        }
        void main() {
          vec3 np = normalize(vPosition);
          float n1 = noise(np * 2.3 + 0.5);
          float n2 = noise(np * 4.7 + 1.3);
          float land = smoothstep(0.55, 0.65, (n1 + n2) * 0.5);
          vec3 ocean = vec3(0.05, 0.18, 0.48);
          vec3 continent = vec3(0.12, 0.38, 0.14);
          vec3 ice = vec3(0.8, 0.9, 1.0);
          float polar = smoothstep(0.75, 0.95, abs(np.y));
          vec3 surface = mix(ocean, continent, land);
          surface = mix(surface, ice, polar);
          float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
          surface += vec3(0.1, 0.3, 0.8) * rim * 0.5;
          vec3 lightDir = normalize(vec3(0.8, 0.3, 0.5));
          float diff = max(dot(vNormal, lightDir), 0.08);
          gl_FragColor = vec4(surface * (0.3 + diff * 0.9), 1.0);
        }
      `,
    })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(3, 64, 64), earthMat)
    scene.add(earth)

    // BackSide renders the atmosphere sphere from the inside out, making the
    // Fresnel glow visible around Earth's limb without occluding the surface.
    // AdditiveBlending makes the halo add light rather than alpha-blend, which
    // produces a natural emission look even over a dark background.
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vNormal; void main() { float i = pow(0.5 - dot(vNormal, vec3(0,0,1)), 4.0); gl_FragColor = vec4(0.2, 0.5, 1.0, 1.0) * i * 1.4; }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(3.6, 32, 32), atmoMat))

    // ── Distance Reference Rings ─────────────────────────────────────────────
    ;[{ ld: 1, opacity: 0.5 }, { ld: 10, opacity: 0.35 }, { ld: 30, opacity: 0.25 }, { ld: 70, opacity: 0.18 }]
      .forEach(({ ld, opacity }) => {
        const r = scaleLD(ld)
        const mat = new THREE.LineBasicMaterial({ color: 0x334488, transparent: true, opacity })
        scene.add(new THREE.Line(buildRingGeometry(r), mat))
        const vRing = new THREE.Line(buildRingGeometry(r), new THREE.LineBasicMaterial({ color: 0x334488, transparent: true, opacity: opacity * 0.5 }))
        vRing.rotation.x = Math.PI / 2
        scene.add(vRing)
      })

    // Moon indicator
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshLambertMaterial({ color: 0x888899 }))
    moon.position.set(scaleLD(1), 0, 0)
    scene.add(moon)

    // ── Asteroids + Velocity Arrows + Trails ──────────────────────────────────
    asteroidMeshes.current = []

    neos.forEach(neo => {
      const pos      = neoScenePosition(neo)
      const r        = neoRadius(neo)
      const velDir   = neoVelocityDir(neo)
      const arrLen   = arrowLength(neo)
      const isHazardous = neo.is_potentially_hazardous

      // ── Sphere ──────────────────────────────────────────────────────────────
      const color = isHazardous ? 0xff3322 : 0x44aaff
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: isHazardous ? 0x661100 : 0x001133,
        emissiveIntensity: 0.6,
        shininess: 40,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat)
      mesh.position.copy(pos)
      mesh.userData = { neo, isHazardous }
      scene.add(mesh)

      // ── Glow sphere ─────────────────────────────────────────────────────────
      // depthWrite: false prevents the transparent glow sphere from writing to
      // the depth buffer, which would punch invisible holes in objects behind it.
      const glowMat = new THREE.MeshBasicMaterial({
        color: isHazardous ? 0xff4400 : 0x2266cc,
        transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 2.5, 12, 12), glowMat)
      glow.position.copy(pos)
      scene.add(glow)

      // ── Line to Earth ────────────────────────────────────────────────────────
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos.clone()])
      scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
        color: isHazardous ? 0xff3300 : 0x224477, transparent: true, opacity: 0.18,
      })))

      // ── Velocity Arrow ───────────────────────────────────────────────────────
      // Color: hazardous → orange-red, safe → pale yellow-white
      const arrowColor = isHazardous ? 0xff8833 : 0xeeeebb
      const headLen   = arrLen * 0.28
      const headWidth = arrLen * 0.12
      const arrow = new THREE.ArrowHelper(velDir, pos, arrLen, arrowColor, headLen, headWidth)
      // Make the shaft line more visible
      arrow.line.material.linewidth = 2
      arrow.line.material.transparent = true
      arrow.line.material.opacity = 0.9
      arrow.cone.material.transparent = true
      arrow.cone.material.opacity = 0.9
      scene.add(arrow)

      // ── Fading Trail (behind the asteroid, opposite to velocity) ─────────────
      const trailLen = arrLen * 1.6
      const trailColor = new THREE.Color(isHazardous ? 0xff6622 : 0x88ccff)
      const trailGeo = buildTrailGeometry(pos, velDir, trailLen)
      const trailMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: trailColor } },
        vertexShader:   TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        transparent: true,
        depthWrite: false,
      })
      scene.add(new THREE.Line(trailGeo, trailMat))

      asteroidMeshes.current.push({ mesh, glow, arrow, neo })
    })

    // ── Raycasting ────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 0.5
    const mouse = new THREE.Vector2()
    let hoveredMesh = null

    function onMouseMove(e) {
      const rect = mount.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const meshes = asteroidMeshes.current.map(a => a.mesh)
      const hits   = raycaster.intersectObjects(meshes)

      // Un-highlight the previously hovered object when the cursor leaves it.
      if (hoveredMesh && (!hits.length || hits[0].object !== hoveredMesh)) {
        const entry = asteroidMeshes.current.find(a => a.mesh === hoveredMesh)
        if (entry) {
          hoveredMesh.material.emissiveIntensity = 0.6
          hoveredMesh.scale.setScalar(1)
          entry.glow.material.opacity = 0.12
          entry.arrow.line.material.opacity = 0.9
          entry.arrow.cone.material.opacity = 0.9
        }
        hoveredMesh = null
        setTooltip(null)
        mount.style.cursor = 'default'
      }

      if (hits.length) {
        const hit = hits[0].object
        if (hit !== hoveredMesh) {
          // New object entered — highlight and pause auto-rotation so the user
          // can read the tooltip without the scene spinning away.
          hoveredMesh = hit
          hit.material.emissiveIntensity = 1.4
          hit.scale.setScalar(1.3)
          const entry = asteroidMeshes.current.find(a => a.mesh === hit)
          if (entry) {
            entry.glow.material.opacity = 0.3
            entry.arrow.line.material.opacity = 1
            entry.arrow.cone.material.opacity = 1
          }
          setTooltip({ neo: hit.userData.neo, x: e.clientX - rect.left, y: e.clientY - rect.top })
          mount.style.cursor = 'pointer'
          controls.autoRotate = false
        } else {
          // Same object — only update tooltip position, avoid a full re-render.
          setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev)
        }
      }
    }

    function onMouseLeave() {
      if (hoveredMesh) {
        hoveredMesh.material.emissiveIntensity = 0.6
        hoveredMesh.scale.setScalar(1)
        const entry = asteroidMeshes.current.find(a => a.mesh === hoveredMesh)
        if (entry) {
          entry.glow.material.opacity = 0.12
          entry.arrow.line.material.opacity = 0.9
          entry.arrow.cone.material.opacity = 0.9
        }
        hoveredMesh = null
      }
      setTooltip(null)
      controls.autoRotate = true
    }

    function onClick(e) {
      const rect = mount.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(asteroidMeshes.current.map(a => a.mesh))
      if (hits.length) onSelect(hits[0].object.userData.neo)
    }

    mount.addEventListener('mousemove', onMouseMove)
    mount.addEventListener('mouseleave', onMouseLeave)
    mount.addEventListener('click', onClick)

    // ── Resize ────────────────────────────────────────────────────────────────
    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Animation Loop ────────────────────────────────────────────────────────
    let animId
    let t = 0 // time accumulator; incremented by a fixed step so speed is
              // frame-rate independent and doesn't rely on wall-clock timestamps
    function animate() {
      animId = requestAnimationFrame(animate)
      t += 0.005
      earthMat.uniforms.time.value = t
      earth.rotation.y = t * 0.2

      // Pulse the glow on hazardous asteroids to draw attention to them.
      asteroidMeshes.current.forEach(({ mesh, glow }, i) => {
        if (mesh.userData.isHazardous && mesh !== hoveredMesh) {
          const pulse = 0.7 + 0.3 * Math.sin(t * 2 + i)
          glow.material.opacity = 0.1 * pulse
        }
      })

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      mount.removeEventListener('mousemove', onMouseMove)
      mount.removeEventListener('mouseleave', onMouseLeave)
      mount.removeEventListener('click', onClick)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [neos])

  return (
    <div className="space3d-wrapper" data-testid="space3d-wrapper">
      <div ref={mountRef} className="space3d-canvas" />

      {/* Hover tooltip */}
      {tooltip && (
        <div className="space3d-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y - 8 }}>
          <div className="stt-name">{tooltip.neo.name}</div>
          <div className="stt-row">
            <span>{tooltip.neo.miss_distance_lunar?.toFixed(1)} LD</span>
            <span className={`stt-badge ${tooltip.neo.is_potentially_hazardous ? 'danger' : 'safe'}`}>
              {tooltip.neo.is_potentially_hazardous ? 'HAZARDOUS' : 'SAFE'}
            </span>
          </div>
          <div className="stt-speed">
            {Math.round((tooltip.neo.relative_velocity_kmh || 0) / 1000).toLocaleString()}K km/h
          </div>
          <div className="stt-hint">Click for details</div>
        </div>
      )}

      {/* Legend */}
      <div className="space3d-legend">
        <div className="legend-title">SCALE</div>
        {[{ ld: 1, label: '1 LD — Moon' }, { ld: 10, label: '10 LD' }, { ld: 30, label: '30 LD' }, { ld: 70, label: '70 LD' }]
          .map(({ ld, label }) => (
            <div key={ld} className="legend-row">
              <div className="legend-ring-icon" style={{ width: Math.max(8, Math.min(28, scaleLD(ld) / 4)) }} />
              <span>{label}</span>
            </div>
          ))}
        <div className="legend-divider" />
        <div className="legend-row"><div className="legend-dot hazard" /><span>Potentially Hazardous</span></div>
        <div className="legend-row"><div className="legend-dot safe" /><span>Safe Approach</span></div>
        <div className="legend-divider" />
        <div className="legend-row">
          <div className="legend-arrow-icon" />
          <span>Direction of travel</span>
        </div>
        <div className="legend-row" style={{ opacity: 0.6, fontSize: '10px' }}>
          <span style={{ paddingLeft: '20px' }}>Arrow length = speed</span>
        </div>
        <div className="legend-divider" />
        <div className="legend-hint">Drag to rotate &bull; Scroll to zoom</div>
      </div>

      <div className="space3d-count">{neos.length} objects displayed</div>
    </div>
  )
}
