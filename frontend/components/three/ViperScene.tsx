"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "../motion/useReducedMotion";

const CONTROL_POINTS = [
  new THREE.Vector3(-3.2, 0, 0),
  new THREE.Vector3(-2.0, 0.6, 0.4),
  new THREE.Vector3(-0.8, -0.5, -0.3),
  new THREE.Vector3(0.4, 0.5, 0.4),
  new THREE.Vector3(1.6, -0.4, -0.2),
  new THREE.Vector3(2.8, 0.2, 0),
];

const LENGTH_SEGMENTS = 48;
const RADIAL_SEGMENTS = 10;
const MAX_RADIUS = 0.42;

function buildViperGeometry() {
  const curve = new THREE.CatmullRomCurve3(CONTROL_POINTS, false, "catmullrom", 0.5);
  const points = curve.getSpacedPoints(LENGTH_SEGMENTS);
  const frames = curve.computeFrenetFrames(LENGTH_SEGMENTS, false);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
    const t = i / LENGTH_SEGMENTS;
    const headBulge = Math.min(Math.sin(Math.min(t / 0.12, 1) * Math.PI * 0.5) + 0.55, 1);
    const tailTaper = 1 - Math.pow(t, 2.2);
    const radius = MAX_RADIUS * headBulge * tailTaper;

    const center = points[i];
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];

    for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
      const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      positions.push(
        center.x + radius * (cos * normal.x + sin * binormal.x),
        center.y + radius * (cos * normal.y + sin * binormal.y),
        center.z + radius * (cos * normal.z + sin * binormal.z),
      );
      uvs.push(j / RADIAL_SEGMENTS, t * 6);
    }
  }

  const ringVertCount = RADIAL_SEGMENTS + 1;
  for (let i = 0; i < LENGTH_SEGMENTS; i++) {
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const a = i * ringVertCount + j;
      const b = a + ringVertCount;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return {
    geometry,
    headPosition: points[0].clone(),
    headTangent: frames.tangents[0].clone(),
  };
}

function buildScaleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2f5233";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(198,255,61,0.25)";
  ctx.lineWidth = 1;

  const rows = 8;
  const cols = 8;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const offsetX = (r % 2) * (cellW / 2);
      const cx = c * cellW + offsetX;
      const cy = r * cellH;
      ctx.beginPath();
      ctx.moveTo(cx, cy - cellH / 2);
      ctx.lineTo(cx + cellW / 2, cy);
      ctx.lineTo(cx, cy + cellH / 2);
      ctx.lineTo(cx - cellW / 2, cy);
      ctx.closePath();
      ctx.fillStyle = (r + c) % 2 === 0 ? "#345a38" : "#294a2d";
      ctx.fill();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function Tongue({ reducedRef }: { reducedRef: React.RefObject<boolean> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reducedRef.current || !ref.current) return;
    ref.current.scale.x = 0.6 + Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.4;
  });
  return (
    <mesh ref={ref} position={[-0.62, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
      <planeGeometry args={[0.28, 0.02]} />
      <meshBasicMaterial color="#c6ff3d" side={THREE.DoubleSide} />
    </mesh>
  );
}

function ViperMesh({
  scale = 1,
  scrollLinked = false,
}: {
  scale?: number;
  scrollLinked?: boolean;
}) {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const groupRef = useRef<THREE.Group>(null);
  const scrollFactor = useRef(0);

  const { geometry, headPosition, headTangent } = useMemo(() => buildViperGeometry(), []);
  const texture = useMemo(() => buildScaleTexture(), []);
  const headQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), headTangent),
    [headTangent],
  );

  const { scrollYProgress } = useScroll();
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    scrollFactor.current = scrollLinked ? v : 0;
  });

  useFrame((state, delta) => {
    if (reducedRef.current || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.15 + scrollFactor.current * delta * 0.6;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
  });

  return (
    <group ref={groupRef} scale={scale}>
      <mesh geometry={geometry}>
        <meshStandardMaterial map={texture} roughness={0.55} metalness={0.1} />
      </mesh>
      <group position={headPosition} quaternion={headQuaternion}>
        <mesh scale={[1, 0.85, 1.15]}>
          <sphereGeometry args={[0.46, 20, 20]} />
          <meshStandardMaterial color="#2f5233" roughness={0.5} />
        </mesh>
        <mesh position={[-0.3, 0.12, 0.28]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#c6ff3d" emissive="#c6ff3d" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[-0.3, 0.12, -0.28]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#c6ff3d" emissive="#c6ff3d" emissiveIntensity={0.8} />
        </mesh>
        <Tongue reducedRef={reducedRef} />
      </group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
    </group>
  );
}

/** Mounted once (in layout.tsx via ViperCanvasIsland) — a single shared WebGL
 * context, fixed behind all page content. Individual pages never render this
 * directly; they render `ViperView` instead, which portals into this canvas. */
export function ViperCanvasRoot() {
  return (
    <Canvas
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      eventSource={document.body}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 6], fov: 40 }}
    >
      <View.Port />
    </Canvas>
  );
}

/** Rendered per-page at the spot the viper should visually appear. Portals its
 * children into the single shared canvas rather than mounting a new one. */
export function ViperView({
  scale = 1,
  scrollLinked = false,
  className = "",
}: {
  scale?: number;
  scrollLinked?: boolean;
  className?: string;
}) {
  return (
    <View className={`h-full w-full ${className}`}>
      <ViperMesh scale={scale} scrollLinked={scrollLinked} />
    </View>
  );
}
