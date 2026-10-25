import { useId } from 'react'

// Back of a face-down tac op card. Laid out to match the printed card
// (public/images/tacOps/hidden-tac-op.png, 976x1699) so the units below are that
// photo's pixels. The emblem is cropped from the photo; everything else is vector.
// `color` is the owning player's colour, shown as a thin outer border.
const W = 976
const H = 1699
const ACCENT = '#e2553f'
const EMBLEM = { cx: 489.5, cy: 852, size: 680 }

// Faint pale V shapes in the lower half, meeting below the centre.
const CHEVRONS = [
  { apex: 1720, rise: 1180, spread: 640 },
  { apex: 1690, rise: 1080, spread: 600 },
  { apex: 1580, rise: 900, spread: 520 },
  { apex: 1555, rise: 860, spread: 505 },
  { apex: 1420, rise: 640, spread: 380 },
]

// Slightly lighter angular shards in the scuffed lower corners.
const SHARDS = [
  '0,1180 210,1010 330,1290 0,1560',
  '120,1450 360,1330 300,1699 40,1699',
  '700,1240 976,1080 976,1420 820,1470',
  '600,1500 860,1600 760,1699 520,1699',
]

function Title() {
  return (
    <g>
      <text
        x="90"
        y="165"
        fill="#f4f2ec"
        fontFamily="'Oswald', 'Arial Narrow', sans-serif"
        fontWeight="600"
        fontSize="108"
        transform="translate(90 0) scale(0.9 1) translate(-90 0)"
      >
        TAC OP
      </text>
      <rect x="0" y="183" width="350" height="5" fill={ACCENT} />
    </g>
  )
}

function TacOpBack({ color = null, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Face-down tac op">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#6b6c6c" />
          <stop offset="0.38" stopColor="#4a4b4b" />
          <stop offset="0.66" stopColor="#2b2b2c" />
          <stop offset="1" stopColor="#18181a" />
        </linearGradient>
        {/* Misty, uneven print in the upper half. */}
        <filter id={`${id}-mist`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.006" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.12" />
        </filter>
        {/* Fine grain over the whole card. */}
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 -0.18" />
        </filter>
        <linearGradient id={`${id}-mist-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mist-mask`}>
          <rect width={W} height={H} fill={`url(#${id}-mist-fade)`} />
        </mask>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id={`${id}-card`}>
          <rect width={W} height={H} rx="22" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-card)`}>
        <rect width={W} height={H} fill={`url(#${id}-bg)`} />
        <rect width={W} height={H} filter={`url(#${id}-mist)`} mask={`url(#${id}-mist-mask)`} opacity="0.5" />
        {SHARDS.map((points) => (
          <polygon key={points} points={points} fill="#ffffff" fillOpacity="0.035" />
        ))}
        <g fill="none" stroke="#e8e6e0" strokeOpacity="0.16" strokeWidth="2">
          {CHEVRONS.map(({ apex, rise, spread }) => (
            <polyline
              key={apex}
              points={`${W / 2 - spread * 1.6},${apex - rise * 1.6} ${W / 2},${apex} ${W / 2 + spread * 1.6},${apex - rise * 1.6}`}
            />
          ))}
        </g>
        <rect width={W} height={H} filter={`url(#${id}-grain)`} opacity="0.35" />

        <circle cx={EMBLEM.cx + 6} cy={EMBLEM.cy + 14} r={EMBLEM.size / 2 - 4} fill="#000" opacity="0.35" filter={`url(#${id}-shadow)`} />
        <image
          href="/images/tacOps/tac-op-emblem.png"
          x={EMBLEM.cx - EMBLEM.size / 2}
          y={EMBLEM.cy - EMBLEM.size / 2}
          width={EMBLEM.size}
          height={EMBLEM.size}
        />

        <Title />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <Title />
        </g>
      </g>
      <rect
        x="3"
        y="3"
        width={W - 6}
        height={H - 6}
        rx="20"
        fill="none"
        stroke={color ?? '#ffffff'}
        strokeOpacity={color ? 0.9 : 0.1}
        strokeWidth="6"
      />
    </svg>
  )
}

export default TacOpBack
