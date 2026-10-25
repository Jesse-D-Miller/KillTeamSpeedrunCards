import { trailPoints } from '../../shared/geometry.js'

// The overlays a live drag preview draws (on the iPad that drags and on every other
// screen that receives it). The distance moved is always shown in the middle of the
// piece being dragged.
//   path:   a battle move in locked 1" steps, plus the finger (tip) beyond them
//   trail:  a pre-battle operative move, measured along the route in 1" legs
//   origin: a blank token or marker, measured in a straight line
export const dragOverlays = (payload) => {
  if (payload.path) return [{ tool: 'move', path: payload.path, tip: payload.x != null ? payload : null }]
  if (payload.trail) return [{ tool: 'measure', points: trailPoints(payload), onToken: true }]
  if (payload.origin && payload.x != null) return [{ tool: 'count', from: payload.origin, to: payload }]
  return []
}
