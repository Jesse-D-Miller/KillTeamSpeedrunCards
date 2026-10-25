// Projective mapping used to warp the board onto the physical table (keystone + scale).

// Solve an 8x8 linear system with Gaussian elimination (partial pivoting).
const solve = (matrix, vector) => {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = a[row][col] / a[col][col]
      for (let k = col; k <= n; k += 1) a[row][k] -= factor * a[col][k]
    }
  }
  return a.map((row, index) => row[n] / row[index])
}

// Homography H (3x3, row-major, h33 = 1) mapping src[i] -> dst[i] for 4 point pairs.
export const computeHomography = (src, dst) => {
  const matrix = []
  const vector = []
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    vector.push(u)
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    vector.push(v)
  }
  const h = solve(matrix, vector)
  if (!h) return null
  return [...h, 1]
}

export const applyHomography = (h, { x, y }) => {
  const w = h[6] * x + h[7] * y + h[8]
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }
}

// CSS matrix3d (column-major 4x4) for an element whose top-left is at the origin.
export const toCssMatrix3d = (h) =>
  `matrix3d(${[
    h[0], h[3], 0, h[6],
    h[1], h[4], 0, h[7],
    0, 0, 1, 0,
    h[2], h[5], 0, h[8],
  ].join(',')})`
