// Lot outlines as closed 2D polygons (local coords, centered near origin).
// Any of these can be handed to <GlowPlane outline={...} />.

/** A single 2D outline vertex. */
export type Point = [number, number];

/** Axis-aligned rectangle centered at the origin. */
export function rect(w: number, d: number): Point[] {
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
}

/** Regular n-gon (pentagon, hexagon, ...) of the given radius. */
export function regularPoly(
  sides: number,
  radius: number,
  rotation = 0
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return pts;
}

/** L-shaped lot (concave). */
export const LShape: Point[] = [
  [-5, -5],
  [3, -5],
  [3, 0],
  [1, 0],
  [1, 5],
  [-5, 5],
];

/** A T-shaped lot (concave). */
export const TShape: Point[] = [
  [-6, 3],
  [-2, 3],
  [-2, -4],
  [2, -4],
  [2, 3],
  [6, 3],
  [6, 6],
  [-6, 6],
];

/** An irregular convex-ish blob (hand-picked). */
export const Irregular: Point[] = [
  [-6, -2],
  [-3, -5],
  [2, -6],
  [6, -2],
  [5, 3],
  [1, 6],
  [-4, 5],
  [-7, 1],
];

/** A pointed arrow / chevron style irregular concave shape. */
export const Chevron: Point[] = [
  [-6, -4],
  [0, -1],
  [6, -4],
  [6, 1],
  [0, 6],
  [-6, 1],
];
