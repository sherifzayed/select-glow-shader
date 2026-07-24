import { useMemo } from "react";
import { shaderMaterial } from "@react-three/drei";
import { extend, type MaterialNode } from "@react-three/fiber";
import {
  Color,
  Vector2,
  ShaderMaterial,
  DoubleSide,
  AdditiveBlending,
  type Side,
} from "three";
import type { Point } from "./shapes";

// Max outline vertices the shader can handle. The uniform array is fixed-size
// (GLSL requirement); shapes with fewer points pad the rest and set uCount.
const MAX_POINTS = 64;

export interface FakeGlowMaterialProps {
  /** Lot outline as 2D points in the geometry's local (shape) space. Any
   *  polygon: rectangle, L-shape, concave/irregular. The shader measures each
   *  fragment's distance to the nearest edge of THIS outline. */
  points: Point[];
  /** Width, in world units, of the glowing band measured inward from the edge. */
  edgeThickness?: number;
  /** Falloff exponent of the edge band. Higher = tighter, brighter edge line. */
  edgeSharpness?: number;
  /** View-dependent fresnel glow filling the interior. 0 = edges only. */
  innerGlow?: number;
  /** Glow color, hexadecimal. */
  glowColor?: string;
  /** Material side. */
  side?: Side;
  /** Enable/disable depthTest. */
  depthTest?: boolean;
  /** Enable/disable depthWrite. */
  depthWrite?: boolean;
  /** Overall opacity. */
  opacity?: number;
}

// Register the custom material as a lowercase JSX intrinsic element. It only
// receives standard ShaderMaterial props here (side, blending, ...); the glow
// uniforms are baked in via shaderMaterial's initial values below.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      fakeGlowMaterial: MaterialNode<ShaderMaterial, typeof ShaderMaterial>;
    }
  }
}

/**
 * FakeGlowMaterial — extended, shape-aware variant.
 * Original fresnel glow by Anderson Mancini (Feb 2024); extended here to take
 * an arbitrary polygon outline and compute a per-fragment distance to the
 * nearest edge, so one flat mesh of ANY shape draws its own glowing border.
 */
const FakeGlowMaterial = ({
  points,
  edgeThickness = 0.9,
  edgeSharpness = 2.0,
  innerGlow = 0.25,
  glowColor = "#22e0ff",
  side = DoubleSide,
  depthTest = true,
  depthWrite = false,
  opacity = 1.0,
}: FakeGlowMaterialProps) => {
  const count = Math.min(points.length, MAX_POINTS - 1);

  // Pad the outline to a fixed-length Vector2 array for the uniform. The first
  // vertex is duplicated at index `count` so the shader can close the polygon
  // with a plain `uPoints[i + 1]` (a constant-index-expression) instead of a
  // conditional wrap index, which some GLSL ES 1.00 drivers reject.
  const padded = useMemo(() => {
    const arr: Vector2[] = new Array(MAX_POINTS);
    for (let i = 0; i < MAX_POINTS; i++) {
      const p = i < count ? points[i] : points[0];
      arr[i] = new Vector2(p ? p[0] : 0, p ? p[1] : 0);
    }
    return arr;
  }, [points, count]);

  const FakeGlowMaterialImpl = useMemo(() => {
    return shaderMaterial(
      {
        uPoints: padded,
        uCount: count,
        uEdgeThickness: edgeThickness,
        uEdgeSharpness: edgeSharpness,
        uInnerGlow: innerGlow,
        glowColor: new Color(glowColor),
        opacity: opacity,
      },
      /*GLSL vertex */
      `
      varying vec2 vLocal;
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * modelPosition;
        vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
        vLocal = position.xy;      // shape-local 2D coords (matches uPoints)
        vPosition = modelPosition.xyz;
        vNormal = modelNormal.xyz;
      }`,
      /*GLSL fragment */
      `
      #define MAX_POINTS ${MAX_POINTS}

      uniform vec3 glowColor;
      uniform vec2 uPoints[MAX_POINTS];
      uniform int uCount;
      uniform float uEdgeThickness;
      uniform float uEdgeSharpness;
      uniform float uInnerGlow;
      uniform float opacity;

      varying vec2 vLocal;
      varying vec3 vPosition;
      varying vec3 vNormal;

      // Shortest distance from point p to segment a-b.
      float distToSeg(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        return length(pa - ba * h);
      }

      void main() {
        // Distance to the nearest edge of the (closed) outline polygon.
        // uPoints[uCount] duplicates uPoints[0], so segment i is (i, i+1) for
        // all edges including the closing one — no conditional wrap index.
        float minDist = 1e9;
        for (int i = 0; i < MAX_POINTS - 1; i++) {
          if (i >= uCount) break;
          minDist = min(minDist, distToSeg(vLocal, uPoints[i], uPoints[i + 1]));
        }

        // Border band: bright at the edge, fading uEdgeThickness inward.
        float border = 1.0 - smoothstep(0.0, uEdgeThickness, minDist);
        border = pow(border, uEdgeSharpness);

        // Fresnel: the view-dependent "inner glow" that fills the surface.
        vec3 normal = normalize(vNormal);
        if(!gl_FrontFacing) normal *= -1.0;
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = pow(clamp(dot(viewDirection, normal), 0.0, 1.0), 2.0);

        float glow = clamp(border + uInnerGlow * fresnel, 0.0, 1.0);
        gl_FragColor = vec4(glowColor, glow * opacity);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
    );
  }, [padded, count, edgeThickness, edgeSharpness, innerGlow, glowColor, opacity]);

  extend({ FakeGlowMaterial: FakeGlowMaterialImpl });

  return (
    <fakeGlowMaterial
      key={FakeGlowMaterialImpl.key}
      side={side}
      transparent={true}
      blending={AdditiveBlending}
      depthTest={depthTest}
      depthWrite={depthWrite}
    />
  );
};

export default FakeGlowMaterial;
