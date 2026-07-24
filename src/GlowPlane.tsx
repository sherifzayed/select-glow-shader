import { useMemo } from "react";
import { PlaneGeometry, DoubleSide } from "three";
import FakeGlowMaterial from "./FakeGlowMaterial";
import type { Point } from "./shapes";

export interface GlowPlaneProps {
  /** Closed polygon outline in local 2D coords. */
  outline: Point[];
  position?: [number, number, number];
  glowColor?: string;
  edgeThickness?: number;
  edgeSharpness?: number;
  innerGlow?: number;
  outerGlow?: number;
  outerDistance?: number;
  outerSharpness?: number;
  opacity?: number;
}

/**
 * A ground "lot" of an ARBITRARY outline (rectangle, L-shape, polygon,
 * irregular) with a shape-aware FakeGlow border.
 *
 * The same outline drives two things: a ShapeGeometry for the grass surface,
 * and the `points` uniform the shader uses to compute each fragment's distance
 * to the nearest edge — so a single mesh draws its own glowing border, whatever
 * the shape.
 */
export default function GlowPlane({
  outline,
  position = [0, 0, 0],
  glowColor = "#22e0ff",
  edgeThickness = 0.9,
  edgeSharpness = 2.2,
  innerGlow = 0.2,
  outerGlow = 0.8,
  outerDistance = 2.0,
  outerSharpness = 2.0,
  opacity = 1,
}: GlowPlaneProps) {
  // The glow (edge band + inner/outer halo) is computed in the shader from the
  // outline itself, so the geometry only needs to supply fragments wherever the
  // glow can appear. A ShapeGeometry stops at the outline — leaving nowhere to
  // draw the OUTER halo. Instead we use the outline's bounding box padded by the
  // outer-glow reach, so fragments exist beyond every edge.
  const geometry = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of outline) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = outerDistance + 0.5;
    const g = new PlaneGeometry(maxX - minX + pad * 2, maxY - minY + pad * 2);
    // Center the plane on the outline's bbox so local xy matches outline space.
    g.translate((minX + maxX) / 2, (minY + maxY) / 2, 0);
    return g;
  }, [outline, outerDistance]);

  return (
    <group position={position}>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <FakeGlowMaterial
          points={outline}
          glowColor={glowColor}
          edgeThickness={edgeThickness}
          edgeSharpness={edgeSharpness}
          innerGlow={innerGlow}
          outerGlow={outerGlow}
          outerDistance={outerDistance}
          outerSharpness={outerSharpness}
          opacity={opacity}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
