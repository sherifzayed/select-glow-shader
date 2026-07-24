import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useControls } from "leva";
import GlowPlane from "./GlowPlane";
import {
  rect,
  regularPoly,
  LShape,
  TShape,
  Irregular,
  Chevron,
} from "./shapes";

/**
 * Different-sized grass "lot" planes on a warm ground, each with a
 * FakeGlowMaterial selection glow. Orbit to view.
 *
 * Note: FakeGlowMaterial uses additive blending, so the glow reads where it
 * overlaps the (darker) ground, just like the reference. Against the white
 * sky above the horizon it naturally fades out.
 */
export default function App() {
  const glow = useControls("Glow", {
    edgeThickness: { value: 0.9, min: 0, max: 3, step: 0.01 },
    edgeSharpness: { value: 2.2, min: 0.1, max: 6, step: 0.1 },
    innerGlow: { value: 0.25, min: 0, max: 1, step: 0.01 },
    outerGlow: { value: 0.8, min: 0, max: 2, step: 0.01 },
    outerDistance: { value: 2.0, min: 0, max: 8, step: 0.1 },
    outerSharpness: { value: 2.0, min: 0.1, max: 6, step: 0.1 },
    opacity: { value: 0.85, min: 0, max: 1, step: 0.01 },
  });

  const travel = useControls("Traveling highlight", {
    travelColor: "#ffffff",
    travelStrength: { value: 0.39, min: 0, max: 3, step: 0.01 },
    travelSpeed: { value: 0.38, min: -1, max: 1, step: 0.01 },
    travelLength: { value: 0.29, min: 0.01, max: 1, step: 0.01 },
    travelFeather: { value: 0.32, min: 0, max: 0.5, step: 0.01 },
    travelWidth: { value: 0.97, min: 0.01, max: 3, step: 0.01 },
    travelSharpness: { value: 4.8, min: 0.1, max: 6, step: 0.1 },
  });

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [14, 12, 16], fov: 42 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#ffffff"]} />

      <ambientLight intensity={0.5} />

      {/* Warm dirt ground, like the reference surround */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#c8794a" roughness={1} />
      </mesh>
      <GlowPlane
        outline={rect(14, 10)}
        position={[0, 0, 0]}
        glowColor="#22e0ff"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={rect(6, 6)}
        position={[-16, 0, 6]}
        glowColor="#37f5c8"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={rect(5, 12)}
        position={[16, 0, -4]}
        glowColor="#3aa0ff"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={LShape}
        position={[-14, 0, -14]}
        glowColor="#7a5cff"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={regularPoly(6, 6)}
        position={[15, 0, 15]}
        glowColor="#ff8a3a"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={regularPoly(5, 5.5)}
        position={[2, 0, -20]}
        glowColor="#ff5ca8"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={Irregular}
        position={[-20, 0, 20]}
        glowColor="#5cff8a"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={TShape}
        position={[24, 0, 8]}
        glowColor="#ffd23a"
        {...glow}
        {...travel}
      />
      <GlowPlane
        outline={Chevron}
        position={[-2, 0, 22]}
        glowColor="#3affe0"
        {...glow}
        {...travel}
      />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.05}
        minDistance={6}
        maxDistance={70}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
