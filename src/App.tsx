import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
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
 * FakeGlowMaterial selection glow. Orbit to view; hover a lot to intensify.
 *
 * Note: FakeGlowMaterial uses additive blending, so the glow reads where it
 * overlaps the (darker) ground, just like the reference. Against the white
 * sky above the horizon it naturally fades out.
 */
export default function App() {
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
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.35}
        scale={70}
        blur={2.4}
        far={12}
      />

      {/* Grass lots of different sizes AND shapes — the shader draws each
          outline's glowing border, whatever the geometry. */}
      <GlowPlane outline={rect(14, 10)} position={[0, 0, 0]} glowColor="#22e0ff" />
      <GlowPlane outline={rect(6, 6)} position={[-16, 0, 6]} glowColor="#37f5c8" />
      <GlowPlane outline={rect(5, 12)} position={[16, 0, -4]} glowColor="#3aa0ff" />
      <GlowPlane outline={LShape} position={[-14, 0, -14]} glowColor="#7a5cff" />
      <GlowPlane outline={regularPoly(6, 6)} position={[15, 0, 15]} glowColor="#ff8a3a" />
      <GlowPlane outline={regularPoly(5, 5.5)} position={[2, 0, -20]} glowColor="#ff5ca8" />
      <GlowPlane outline={Irregular} position={[-20, 0, 20]} glowColor="#5cff8a" />
      <GlowPlane outline={TShape} position={[24, 0, 8]} glowColor="#ffd23a" />
      <GlowPlane outline={Chevron} position={[-2, 0, 22]} glowColor="#3affe0" />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.05}
        minDistance={6}
        maxDistance={70}
        target={[0, 0, 0]}
      />

      {/* Bloom blurs the bright glow edges into a soft halo — the key to the
          reference look. mipmapBlur gives a wide, cheap blur. */}
      <EffectComposer>
        <Bloom
          intensity={2.2}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.25}
          mipmapBlur
          radius={0.85}
        />
      </EffectComposer>
    </Canvas>
  );
}
