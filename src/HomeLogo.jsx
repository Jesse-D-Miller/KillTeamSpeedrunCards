// The opening screen's logo, burning: a fiery aura whose edges lick and writhe (SVG
// noise displacing a glow), an angry double-thump heartbeat under it, and embers
// rising off the emblem. Still, with no embers, under Reduce Motion.

// Embers: where each starts (% across), how big, how long it takes to rise, and how
// far it drifts sideways. Fixed, so the fire looks the same on every load.
const EMBERS = Array.from({ length: 18 }, (_, index) => {
  const spread = (index * 37) % 100
  return {
    left: 18 + spread * 0.64,
    size: 3 + (index % 4),
    duration: 2.6 + ((index * 7) % 10) * 0.22,
    delay: -((index * 0.61) % 4),
    drift: ((index * 23) % 60) - 30,
  }
})

// Flame tongues rising behind the shield: [x, how high the tip reaches, half-width].
const TONGUES = [
  [96, 70, 26],
  [138, 34, 30],
  [176, 14, 32],
  [214, 4, 34],
  [252, 22, 30],
  [292, 48, 28],
  [322, 86, 22],
]

const tongue = ([x, tip, half]) =>
  `M${x - half} 170 C${x - half} 120 ${x - 8} ${tip + 50} ${x} ${tip} C${x + 8} ${tip + 50} ${x + half} 120 ${x + half} 170 Z`

function HomeLogo() {
  return (
    <div className="home-logo">
      <span className="home-throb" aria-hidden="true" />
      <svg className="home-fire" viewBox="0 0 400 300" aria-hidden="true">
        <defs>
          <radialGradient id="home-fire-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffa53a" stopOpacity="0.7" />
            <stop offset="0.4" stopColor="#f0581a" stopOpacity="0.55" />
            <stop offset="0.75" stopColor="#b8200a" stopOpacity="0.3" />
            <stop offset="1" stopColor="#6e0c04" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="home-fire-tongue" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff9a2e" stopOpacity="0.85" />
            <stop offset="0.45" stopColor="#e8401a" stopOpacity="0.7" />
            <stop offset="1" stopColor="#9c1405" stopOpacity="0" />
          </linearGradient>
          <filter id="home-fire-lick" x="-40%" y="-40%" width="180%" height="180%">
            {/* Noise stretched upright licks the edges like flame; drifting its scale keeps it moving. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.012" numOctaves="3" seed="4" result="noise">
              <animate attributeName="baseFrequency" dur="4s" values="0.04 0.012;0.055 0.018;0.04 0.012" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="46" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <g filter="url(#home-fire-lick)">
          {TONGUES.map((shape) => (
            <path key={shape[0]} d={tongue(shape)} fill="url(#home-fire-tongue)" />
          ))}
          <ellipse cx="200" cy="150" rx="160" ry="105" fill="url(#home-fire-core)" />
        </g>
      </svg>
      {EMBERS.map((ember, index) => (
        <span
          key={index}
          className="home-ember"
          aria-hidden="true"
          style={{
            left: `${ember.left}%`,
            '--size': `${ember.size}px`,
            '--rise': `${ember.duration}s`,
            '--delay': `${ember.delay}s`,
            '--drift': `${ember.drift}px`,
          }}
        />
      ))}
      <img src="/killteamSpeedrunLogo.png" alt="Kill Team Speedrun" />
    </div>
  )
}

export default HomeLogo
