import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SpaceView3D from './SpaceView3D'

// Three.js uses WebGL which jsdom cannot provide.
// Mock the entire module so we can test the React layer in isolation.
vi.mock('three', () => {
  const Vec3 = class {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
    clone() { return new Vec3(this.x, this.y, this.z) }
    setScalar(s) { this.x = s; this.y = s; this.z = s; return this }
    normalize() { return this }
    dot() { return 0 }
    crossVectors(a, b) { return this }
    addScaledVector(v, s) { return this }
  }
  const noop = () => {}
  const fakeMat = () => ({
    opacity: 0.9, emissiveIntensity: 0.6,
    transparent: false, depthWrite: true, linewidth: 1,
  })
  const noopGeo = () => ({
    set: noop, copy: noop, dispose: noop,
    setFromPoints: () => noopGeo(),
    setAttribute: noop,
  })
  const fakeMesh = () => ({
    position: new Vec3(), rotation: { x: 0, y: 0, z: 0 }, scale: new Vec3(),
    userData: {}, material: fakeMat(),
  })
  const fakeArrow = () => ({
    position: new Vec3(), rotation: { y: 0 }, scale: new Vec3(),
    userData: {},
    line: { material: fakeMat() },
    cone: { material: fakeMat() },
  })
  const fakeRenderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio: noop, setSize: noop, setClearColor: noop,
    render: noop, dispose: noop,
  }
  const Color = class { constructor() {} }
  return {
    WebGLRenderer: vi.fn(() => fakeRenderer),
    Scene: vi.fn(() => ({ add: noop, background: null })),
    PerspectiveCamera: vi.fn(() => ({
      position: new Vec3(), aspect: 1,
      lookAt: noop, updateProjectionMatrix: noop,
    })),
    Vector2: vi.fn(() => ({ x: 0, y: 0 })),
    Vector3: Vec3,
    Color,
    BufferGeometry: vi.fn(noopGeo),
    SphereGeometry: vi.fn(() => ({})),
    RingGeometry: vi.fn(() => ({})),
    AmbientLight: vi.fn(fakeMesh),
    DirectionalLight: vi.fn(fakeMesh),
    Mesh: vi.fn(fakeMesh),
    Line: vi.fn(fakeMesh),
    Points: vi.fn(fakeMesh),
    ArrowHelper: vi.fn(fakeArrow),
    ShaderMaterial: vi.fn(() => ({ uniforms: { time: { value: 0 }, uColor: { value: null } } })),
    MeshPhongMaterial: vi.fn(fakeMat),
    MeshLambertMaterial: vi.fn(fakeMat),
    MeshBasicMaterial: vi.fn(fakeMat),
    LineBasicMaterial: vi.fn(fakeMat),
    PointsMaterial: vi.fn(fakeMat),
    BufferAttribute: vi.fn(() => ({})),
    Float32BufferAttribute: vi.fn(() => ({})),
    Raycaster: vi.fn(() => ({
      setFromCamera: noop,
      intersectObjects: vi.fn(() => []),
      params: { Points: {} },
    })),
    AdditiveBlending: 'AdditiveBlending',
    BackSide: 'BackSide',
  }
})

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn(() => ({
    enableDamping: false,
    dampingFactor: 0,
    minDistance: 0,
    maxDistance: 0,
    autoRotate: false,
    autoRotateSpeed: 0,
    update: vi.fn(),
  })),
}))

// Stub rAF
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

const sampleNEOs = [
  {
    id: '12345',
    name: '(2099 XX1)',
    is_potentially_hazardous: false,
    miss_distance_km: 3_000_000,
    miss_distance_lunar: 7.8,
    est_diameter_min_km: 0.08,
    est_diameter_max_km: 0.18,
    relative_velocity_kmh: 45_000,
    close_approach_date: '2099-06-15',
    orbiting_body: 'Earth',
  },
  {
    id: '99999',
    name: '(2003 LN6)',
    is_potentially_hazardous: true,
    miss_distance_km: 420_000,
    miss_distance_lunar: 1.1,
    est_diameter_min_km: 0.3,
    est_diameter_max_km: 0.7,
    relative_velocity_kmh: 72_000,
    close_approach_date: '2099-06-16',
    orbiting_body: 'Earth',
  },
]

describe('SpaceView3D', () => {
  it('renders the wrapper container', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByTestId('space3d-wrapper')).toBeInTheDocument()
  })

  it('renders the canvas mount div', () => {
    const { container } = render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(container.querySelector('.space3d-canvas')).toBeInTheDocument()
  })

  it('shows the correct object count', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText('2 objects displayed')).toBeInTheDocument()
  })

  it('shows "0 objects displayed" when neos is empty', () => {
    render(<SpaceView3D neos={[]} onSelect={vi.fn()} />)
    expect(screen.getByText('0 objects displayed')).toBeInTheDocument()
  })

  it('renders the legend panel', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText('SCALE')).toBeInTheDocument()
  })

  it('renders legend entries for Potentially Hazardous and Safe', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText('Potentially Hazardous')).toBeInTheDocument()
    expect(screen.getByText('Safe Approach')).toBeInTheDocument()
  })

  it('shows lunar distance reference labels in legend', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText('1 LD — Moon')).toBeInTheDocument()
    expect(screen.getByText('10 LD')).toBeInTheDocument()
  })

  it('shows drag/zoom hint in legend', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText(/drag to rotate/i)).toBeInTheDocument()
  })

  it('does not render tooltip by default', () => {
    const { container } = render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(container.querySelector('.space3d-tooltip')).not.toBeInTheDocument()
  })

  it('renders with a single NEO without crashing', () => {
    render(<SpaceView3D neos={[sampleNEOs[0]]} onSelect={vi.fn()} />)
    expect(screen.getByText('1 objects displayed')).toBeInTheDocument()
  })

  it('accepts an onSelect callback without throwing', () => {
    const onSelect = vi.fn()
    expect(() => render(<SpaceView3D neos={sampleNEOs} onSelect={onSelect} />)).not.toThrow()
  })

  // ── Velocity / direction-of-travel features ──────────────────────────────

  it('shows "Direction of travel" in the legend', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText('Direction of travel')).toBeInTheDocument()
  })

  it('shows "Arrow length = speed" note in the legend', () => {
    render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(screen.getByText(/arrow length = speed/i)).toBeInTheDocument()
  })

  it('renders the CSS arrow icon in the legend', () => {
    const { container } = render(<SpaceView3D neos={sampleNEOs} onSelect={vi.fn()} />)
    expect(container.querySelector('.legend-arrow-icon')).toBeInTheDocument()
  })
})
