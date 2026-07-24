import { useMemo } from "react";
import { Shape, ShapeGeometry, DoubleSide } from "three";
import FakeGlowMaterial from "./FakeGlowMaterial";
import type { Point } from "./shapes";

export interface GlowPlaneProps {
  /** Closed polygon outline in local 2D coords. */
  outline: Point[];
  position?: [number, number, number];
  color?: string;
  glowColor?: string;
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
  color = "#7cae54",
  glowColor = "#22e0ff",
}: GlowPlaneProps) {
  // Build the flat geometry from the outline (shape lives in local XY).
  const geometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) {
      shape.lineTo(outline[i][0], outline[i][1]);
    }
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [outline]);

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
          edgeThickness={0.9}
          edgeSharpness={2.2}
          innerGlow={0.25}
          opacity={0.85}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
