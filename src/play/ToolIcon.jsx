// Small line icons for the map tool rail (24x24, stroked in currentColor).
const PATHS = {
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  measure: 'M4 17 17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2',
  los: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  attack: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 1v6M12 17v6M1 12h6M17 12h6M12 11v2M11 12h2',
  units: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20c0-3.3 2.7-6 6-6s6 2.7 6 6',
  token: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  select: 'M5 3l13 7-6 1.5L9.5 18z M12.5 12.5l5 5',
  fight: 'M4 4l11 11M4 4v4M4 4h4M20 4 9 15M20 4v4M20 4h-4M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3',
  range: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z',
  vantage: 'M3 20h5v-5h5v-5h5V5h3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  name: 'M5 6h14M12 6v13M9 19h6',
  base: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2.5 12h2.5M19 12h2.5',
  remove: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  card: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
  // A new round: an arrow coming back round on itself.
  nextTp: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v5h-5',
  ops: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  equipment: 'M14.5 3.5a4.5 4.5 0 0 0-4.3 5.8L3.5 16v4.5H8l6.7-6.7a4.5 4.5 0 1 0-.2-10.3z',
  firefight: 'M13 2 4 14h7l-1 8 9-12h-7z',
  strat: 'M5 21V4M5 4h12l-2 4 2 4H5',
  faction: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  back: 'M14.5 5.5 8 12l6.5 6.5',
  ping: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  // A side bar with pieces laid out on it.
  board: 'M6 3h12v18H6zM9 6h6v3H9zM9 11h6v2H9zM9 15h3v3H9z',
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
