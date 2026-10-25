export const SEAT_COLORS = {
  A: '#ff5a4e',
  B: '#4ea3ff',
}

export const NEUTRAL_COLOR = '#d9d4c7'

export const seatColor = (seat) => SEAT_COLORS[seat] ?? NEUTRAL_COLOR

// Which seat holds a given drop zone letter (zone -> seat).
export const zoneOwner = (dropZones, zone) =>
  Object.entries(dropZones ?? {}).find(([, value]) => value === zone)?.[0] ?? null
