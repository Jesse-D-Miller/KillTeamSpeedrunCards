// The opening screen's logo, burning:
// - a fire halo right behind it that follows the logo's own outline (shield and
//   wings), grown out and warped into a wavy, flickering edge;
// - long waves of fire rolling out from behind it, fading as they spread;
// - a slow, uneven heartbeat glow;
// - sparks drifting up all over the page, fainter and smaller the further they are
//   from the logo.
// Still, with no waves or sparks, under Reduce Motion.

const LOGO = '/killteamSpeedrunLogo.png'
// The logo image's own size, so the halo lines up with it exactly.
const LOGO_W = 1536
const LOGO_H = 1024

// Fire waves: each takes its own time to roll out and starts at its own point in the
// cycle, so the pulses come unevenly and never settle into a rhythm.
const WAVES = [
  { duration: 7.4, delay: 0 },
  { duration: 8.9, delay: -2.3 },
  { duration: 6.8, delay: -4.1 },
  { duration: 9.6, delay: -6.7 },
]

// Sparks: scattered around the logo out to the edges of the page, most of them close
// in. Fixed (a seeded scatter), so the page looks the same on every load.
const SPARK_COUNT = 64
const SPARK_REACH = 75 // vmax from the logo's centre
const SPARKS = (() => {
  let seed = 11
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  return Array.from({ length: SPARK_COUNT }, () => {
    const angle = random() * Math.PI * 2
    // Squaring pulls most of them in towards the logo.
    const nearness = random() ** 2
    const reach = 0.06 + nearness * 0.94
    const fade = 1 - reach
    return {
      x: Math.cos(angle) * reach * SPARK_REACH,
      y: Math.sin(angle) * reach * SPARK_REACH * 0.8,
      size: 1.5 + fade * 4 + random() * 1.5,
      peak: 0.15 + fade * 0.85,
      duration: 3 + random() * 3.5,
      delay: -random() * 6,
      drift: random() * 60 - 30,
      rise: 110 + random() * 140,
    }
  })
})()

function HomeLogo() {
  return (
    <div className="home-logo">
      {WAVES.map((wave, index) => (
        <svg
          key={index}
          className="home-wave"
          viewBox="0 0 200 200"
          aria-hidden="true"
          style={{ '--wave': `${wave.duration}s`, '--wave-delay': `${wave.delay}s` }}
        >
          <circle cx="100" cy="100" r="96" fill="url(#home-wave-band)" filter="url(#home-wave-lick)" />
        </svg>
      ))}
      <span className="home-throb" aria-hidden="true" />
      <svg className="home-halo" viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} aria-hidden="true">
        <defs>
          {/* A wave: a soft band of fire, bright on its inner edge and smoky outside. */}
          <radialGradient id="home-wave-band" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ff8a1c" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ff8a1c" stopOpacity="0" />
            <stop offset="0.66" stopColor="#ff7a1a" stopOpacity="0.5" />
            <stop offset="0.78" stopColor="#d8300e" stopOpacity="0.38" />
            <stop offset="0.9" stopColor="#7a0e04" stopOpacity="0.12" />
            <stop offset="1" stopColor="#8a1205" stopOpacity="0" />
          </radialGradient>
          <filter id="home-wave-lick" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="9" result="noise">
              <animate attributeName="baseFrequency" dur="7s" values="0.035;0.05;0.035" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          {/* The halo: the logo's outline (its solid pixels, not its faint baked-in glow),
              grown, warped by drifting noise into licking flame, softened, and coloured:
              a red outer fire with a hotter orange one inside it. */}
          <filter id="home-halo-fire" x="-30%" y="-40%" width="160%" height="180%">
            <feComponentTransfer in="SourceAlpha" result="shape">
              <feFuncA type="discrete" tableValues="0 0 1 1 1 1 1 1" />
            </feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.004" numOctaves="3" seed="5" result="noise">
              <animate attributeName="baseFrequency" dur="5s" values="0.012 0.004;0.017 0.006;0.012 0.004" repeatCount="indefinite" />
            </feTurbulence>
            <feMorphology in="shape" operator="dilate" radius="46" result="outerShape" />
            <feDisplacementMap in="outerShape" in2="noise" scale="150" xChannelSelector="R" yChannelSelector="G" result="outerWavy" />
            <feGaussianBlur in="outerWavy" stdDeviation="26" result="outerSoft" />
            <feFlood floodColor="#c8280c" floodOpacity="0.9" />
            <feComposite in2="outerSoft" operator="in" result="outer" />
            <feMorphology in="shape" operator="dilate" radius="16" result="innerShape" />
            <feDisplacementMap in="innerShape" in2="noise" scale="90" xChannelSelector="R" yChannelSelector="G" result="innerWavy" />
            <feGaussianBlur in="innerWavy" stdDeviation="14" result="innerSoft" />
            <feFlood floodColor="#ff9a2e" floodOpacity="0.9" />
            <feComposite in2="innerSoft" operator="in" result="inner" />
            <feMerge>
              <feMergeNode in="outer" />
              <feMergeNode in="inner" />
            </feMerge>
          </filter>
        </defs>
        <image href={LOGO} width={LOGO_W} height={LOGO_H} filter="url(#home-halo-fire)" />
      </svg>
      <img src={LOGO} alt="Kill Team Speedrun" />
      <div className="home-sparks" aria-hidden="true">
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            className="home-ember"
            style={{
              left: `calc(50% + ${spark.x.toFixed(2)}vmax)`,
              top: `calc(50% + ${spark.y.toFixed(2)}vmax)`,
              '--size': `${spark.size.toFixed(1)}px`,
              '--peak': spark.peak.toFixed(2),
              '--rise': `${spark.duration.toFixed(2)}s`,
              '--delay': `${spark.delay.toFixed(2)}s`,
              '--drift': `${spark.drift.toFixed(0)}px`,
              '--climb': `${-spark.rise.toFixed(0)}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default HomeLogo
