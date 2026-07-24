import { useMemo, useRef } from "react";
import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame, type MaterialNode } from "@react-three/fiber";
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
  /** Intensity of the halo bleeding OUTSIDE the outline. 0 = no outer glow. */
  outerGlow?: number;
  /** How far, in world units, the outer glow reaches beyond the edge. */
  outerDistance?: number;
  /** Falloff exponent of the outer halo. Higher = tighter to the edge. */
  outerSharpness?: number;
  /** Glow color, hexadecimal. */
  glowColor?: string;
  /** Color of the traveling highlight segment. */
  travelColor?: string;
  /** Laps per second the highlight makes around the perimeter. 0 = static. */
  travelSpeed?: number;
  /** Length of the highlight segment as a fraction of the total perimeter. */
  travelLength?: number;
  /** Soft fade at each end of the segment, as a fraction of its length. */
  travelFeather?: number;
  /** Width, in world units, of the highlight band measured from the edge. */
  travelWidth?: number;
  /** Falloff exponent across the highlight band. Higher = tighter line. */
  travelSharpness?: number;
  /** Intensity of the traveling highlight. 0 = disabled. */
  travelStrength?: number;
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
  outerGlow = 0.0,
  outerDistance = 2.0,
  outerSharpness = 2.0,
  glowColor = "#22e0ff",
  travelColor = "#ffffff",
  travelSpeed = 0.38,
  travelLength = 0.29,
  travelFeather = 0.32,
  travelWidth = 0.97,
  travelSharpness = 4.8,
  travelStrength = 0.39,
  side = DoubleSide,
  depthTest = true,
  depthWrite = false,
  opacity = 1.0,
}: FakeGlowMaterialProps) => {
  const count = Math.min(points.length, MAX_POINTS - 1);
  const matRef = useRef<ShaderMaterial>(null);

  // Advance the highlight's clock each frame. Mutating the uniform in place
  // avoids rebuilding the material (the shaderMaterial useMemo below).
  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

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

  // Cumulative edge length at the START of each segment, plus the closing
  // length at index `count` (matching padded[count] === points[0]). Lets the
  // shader turn a fragment's nearest-edge hit into a position around the loop.
  const { cumLen, perimeter } = useMemo(() => {
    const cum = new Array<number>(MAX_POINTS).fill(0);
    let total = 0;
    for (let i = 0; i < count; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % count]!;
      cum[i] = total;
      total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    for (let i = count; i < MAX_POINTS; i++) cum[i] = total;
    return { cumLen: cum, perimeter: total || 1 };
  }, [points, count]);

  const FakeGlowMaterialImpl = useMemo(() => {
    return shaderMaterial(
      {
        uPoints: padded,
        uCount: count,
        uEdgeThickness: edgeThickness,
        uEdgeSharpness: edgeSharpness,
        uInnerGlow: innerGlow,
        uOuterGlow: outerGlow,
        uOuterDistance: outerDistance,
        uOuterSharpness: outerSharpness,
        glowColor: new Color(glowColor),
        uCumLen: cumLen,
        uPerimeter: perimeter,
        uTime: 0,
        uTravelColor: new Color(travelColor),
        uTravelSpeed: travelSpeed,
        uTravelLength: travelLength,
        uTravelFeather: travelFeather,
        uTravelWidth: travelWidth,
        uTravelSharpness: travelSharpness,
        uTravelStrength: travelStrength,
        opacity: opacity,
      },
      /*GLSL vertex */
      `varying vec2 vLocal;varying vec3 vPosition,vNormal;
      void main(){vec4 wp=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*wp;vLocal=position.xy;vPosition=wp.xyz;vNormal=mat3(modelMatrix)*normal;}`,
      /*GLSL fragment: distance-to-nearest-edge border + fresnel inner glow */
      `#define N ${MAX_POINTS}
      uniform vec3 glowColor,uTravelColor;uniform vec2 uPoints[N];uniform int uCount;uniform float uCumLen[N];uniform float uEdgeThickness,uEdgeSharpness,uInnerGlow,uOuterGlow,uOuterDistance,uOuterSharpness,opacity;
      uniform float uPerimeter,uTime,uTravelSpeed,uTravelLength,uTravelFeather,uTravelWidth,uTravelSharpness,uTravelStrength;
      varying vec2 vLocal;varying vec3 vPosition,vNormal;
      void main(){
        // Single pass: nearest-edge distance, arc-length of that hit, and the
        // inside/outside test (ray cast).
        float d=1e9;   // distance to nearest edge
        float arc=0.;  // position of that nearest point around the perimeter
        bool inside=false;
        for(int i=0;i<N-1;i++){
          if(i>=uCount)break;
          vec2 a=uPoints[i],b=uPoints[i+1];
          vec2 pa=vLocal-a,ba=b-a;
          float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);
          float dist=length(pa-ba*h);
          if(dist<d){d=dist;arc=mix(uCumLen[i],uCumLen[i+1],h);}
          if(((a.y>vLocal.y)!=(b.y>vLocal.y))&&(vLocal.x<(b.x-a.x)*(vLocal.y-a.y)/(b.y-a.y)+a.x)) inside=!inside;
        }
        vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
        float fres=pow(clamp(dot(normalize(cameraPosition-vPosition),n),0.,1.),2.);
        float alpha;
        if(inside){
          // Inward edge band + view-dependent interior fresnel.
          float border=pow(1.-smoothstep(0.,uEdgeThickness,d),uEdgeSharpness);
          alpha=border+uInnerGlow*fres;
        }else{
          // Halo fading outward from the edge.
          alpha=uOuterGlow*pow(1.-smoothstep(0.,uOuterDistance,d),uOuterSharpness);
        }

        // Traveling white segment: a window that rides around the loop. rel is
        // how far a fragment sits BEHIND the moving head, wrapped over the
        // perimeter, so the lit band is bounded by uTravelLength.
        float head=fract(uTime*uTravelSpeed)*uPerimeter;
        float len=max(uTravelLength*uPerimeter,1e-4);
        float feather=max(uTravelFeather*len,1e-4);
        float rel=mod(head-arc,uPerimeter);
        float along=smoothstep(0.,feather,rel)*(1.-smoothstep(len-feather,len,rel));
        float across=pow(1.-smoothstep(0.,uTravelWidth,d),uTravelSharpness);
        float travel=along*across*uTravelStrength;

        vec3 emission=glowColor*clamp(alpha,0.,1.)+uTravelColor*travel;
        gl_FragColor=vec4(emission,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
    );
  }, [
    padded,
    count,
    edgeThickness,
    edgeSharpness,
    innerGlow,
    outerGlow,
    outerDistance,
    outerSharpness,
    glowColor,
    cumLen,
    perimeter,
    travelColor,
    travelSpeed,
    travelLength,
    travelFeather,
    travelWidth,
    travelSharpness,
    travelStrength,
    opacity,
  ]);

  extend({ FakeGlowMaterial: FakeGlowMaterialImpl });

  return (
    <fakeGlowMaterial
      ref={matRef}
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
