import { useMemo, useState } from "react";
import { Shape, ShapeGeometry, DoubleSide } from "three";
import type { ThreeEvent } from "@react-three/fiber";
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
 * the shape. Hovering intensifies the effect.
 */
export default function GlowPlane({
  outline,
  position = [0, 0, 0],
  color = "#7cae54",
  glowColor = "#22e0ff",
}: GlowPlaneProps) {
  const [hovered, setHovered] = useState(false);

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
      {/* The lot surface */}
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial color={color} roughness={0.95} side={DoubleSide} />
      </mesh>

      {/* Shape-aware glow — one mesh, the shader draws its own border */}
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <FakeGlowMaterial
          points={outline}
          glowColor={glowColor}
          edgeThickness={hovered ? 1.3 : 0.9}
          edgeSharpness={hovered ? 1.6 : 2.2}
          innerGlow={hovered ? 0.45 : 0.25}
          opacity={hovered ? 1.0 : 0.85}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
