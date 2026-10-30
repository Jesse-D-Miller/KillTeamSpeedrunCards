// Small line icons for the map tool rail (24x24, stroked in currentColor).
const PATHS = {
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  measure: 'M4 17 17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2',
  los: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  attack: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 1v6M12 17v6M1 12h6M17 12h6M12 11v2M11 12h2',
  units: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20c0-3.3 2.7-6 6-6s6 2.7 6 6',
  token: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  select: 'M5 3l13 7-6 1.5L9.5 18z M12.5 12.5l5 5',
  ping: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  tabs: 'M4 6h16v4H4zM4 14h16v4H4z',
  fullscreen: 'M4 9V4h5M4 4l6 6M20 9V4h-5M20 4l-6 6M4 15v5h5M4 20l6-6M20 15v5h-5M20 20l-6-6',
  exitFullscreen: 'M10 4v6H4M10 10 4 4M14 4v6h6M14 10l6-6M10 20v-6H4M10 14l-6 6M14 20v-6h6M14 14l6 6',
}

function ToolIcon({ tool }) {
  return (
    <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[tool]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default ToolIcon
