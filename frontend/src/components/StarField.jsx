import { useEffect, useRef } from 'react'

export default function StarField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    function resize() {
      // Assigning canvas dimensions also clears its backing buffer; the next
      // animation frame redraws the full background at the new viewport size.
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const STAR_COUNT = 180
    const NEBULA_COUNT = 4

    // Generate the field once per mount. Keeping these coordinates stable
    // prevents stars from jumping to new positions on every animation frame.
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.2,
      opacity: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
    }))

    const nebulas = Array.from({ length: NEBULA_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 120 + Math.random() * 200,
      hue: [220, 260, 180, 200][Math.floor(Math.random() * 4)],
      opacity: 0.03 + Math.random() * 0.04,
    }))

    let t = 0
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Nebula blobs
      nebulas.forEach(n => {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        grad.addColorStop(0, `hsla(${n.hue}, 70%, 55%, ${n.opacity})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      })

      // Stars
      stars.forEach(s => {
        const op = s.opacity * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.twinklePhase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 220, 255, ${op})`
        ctx.fill()
      })

      t++
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      // Both resources outlive a render unless explicitly released.
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
