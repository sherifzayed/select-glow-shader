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
  const padded = useMemo(
    () =>
      Array.from({ length: MAX_POINTS }, (_, i) => {
        const p = points[i < count ? i : 0] ?? [0, 0];
        return new Vector2(p[0], p[1]);
      }),
    [points, count]
  );

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
      `varying vec2 vLocal;varying vec3 vPosition,vNormal;
      void main(){vec4 wp=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*wp;vLocal=position.xy;vPosition=wp.xyz;vNormal=mat3(modelMatrix)*normal;}`,
      /*GLSL fragment: distance-to-nearest-edge border + fresnel inner glow */
      `#define N ${MAX_POINTS}
      uniform vec3 glowColor;uniform vec2 uPoints[N];uniform int uCount;uniform float uEdgeThickness,uEdgeSharpness,uInnerGlow,opacity;
      varying vec2 vLocal;varying vec3 vPosition,vNormal;
      float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.));}
      void main(){
        float d=1e9;
        for(int i=0;i<N-1;i++){if(i>=uCount)break;d=min(d,seg(vLocal,uPoints[i],uPoints[i+1]));}
        float border=pow(1.-smoothstep(0.,uEdgeThickness,d),uEdgeSharpness);
        vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
        float fres=pow(clamp(dot(normalize(cameraPosition-vPosition),n),0.,1.),2.);
        gl_FragColor=vec4(glowColor,clamp(border+uInnerGlow*fres,0.,1.)*opacity);
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
