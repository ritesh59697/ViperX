"use client";

import React, { useEffect, useRef } from "react";

interface RadarSphereProps {
  active?: boolean;
  className?: string;
  speed?: number; // rotation speed multiplier, default ~1 (slow & graceful)
  color?: string; // default brand accent '#f42601'
}

interface SpherePoint {
  // Target position on unit sphere
  uX: number;
  uY: number;
  uZ: number;
  // Starting dispersed position
  sX: number;
  sY: number;
  sZ: number;
  // Current position
  x: number;
  y: number;
  z: number;
  // Visual properties
  size: number;
  brightness: number;
  delay: number; // Stagger for formation
  isPolar?: boolean;
}

export function RadarSphere({
  active = true,
  className = "w-full h-full",
  speed = 0.55, // Slow, hypnotic, graceful
  color = "#f42601",
}: RadarSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const stateRef = useRef<{
    points: SpherePoint[];
    angleY: number;
    startTime: number;
    formed: boolean;
  }>({
    points: [],
    angleY: 0,
    startTime: 0,
    formed: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Generate sphere points: Fibonacci sphere + dense polar radar rings
    const points: SpherePoint[] = [];
    const totalPoints = 650;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    // 1. Fibonacci distribution for the main sphere body
    for (let i = 0; i < totalPoints; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / totalPoints);

      const uX = Math.sin(phi) * Math.cos(theta);
      const uY = Math.cos(phi);
      const uZ = Math.sin(phi) * Math.sin(theta);

      // Random starting point in a wider shell
      const scatterDist = 2.0 + Math.random() * 1.5;
      const scatterTheta = Math.random() * Math.PI * 2;
      const scatterPhi = Math.random() * Math.PI;

      const sX = scatterDist * Math.sin(scatterPhi) * Math.cos(scatterTheta);
      const sY = scatterDist * Math.cos(scatterPhi);
      const sZ = scatterDist * Math.sin(scatterPhi) * Math.sin(scatterTheta);

      points.push({
        uX,
        uY,
        uZ,
        sX,
        sY,
        sZ,
        x: sX,
        y: sY,
        z: sZ,
        size: 1.1 + Math.random() * 0.9,
        brightness: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 0.4, // 0 to 400ms stagger
      });
    }

    // 2. Concentric dense polar caps (matches the distinctive radar sphere look)
    const polarRings = [
      { y: 0.88, count: 32, radius: Math.sqrt(1 - 0.88 * 0.88) },
      { y: 0.94, count: 24, radius: Math.sqrt(1 - 0.94 * 0.94) },
      { y: 0.98, count: 16, radius: Math.sqrt(1 - 0.98 * 0.98) },
      { y: -0.88, count: 32, radius: Math.sqrt(1 - 0.88 * 0.88) },
      { y: -0.94, count: 24, radius: Math.sqrt(1 - 0.94 * 0.94) },
      { y: -0.98, count: 16, radius: Math.sqrt(1 - 0.98 * 0.98) },
    ];

    polarRings.forEach((ring) => {
      for (let i = 0; i < ring.count; i++) {
        const theta = (2 * Math.PI * i) / ring.count;
        const uX = ring.radius * Math.cos(theta);
        const uY = ring.y;
        const uZ = ring.radius * Math.sin(theta);

        const scatterDist = 2.2 + Math.random() * 1.2;
        points.push({
          uX,
          uY,
          uZ,
          sX: uX * scatterDist,
          sY: uY * scatterDist + (Math.random() - 0.5),
          sZ: uZ * scatterDist,
          x: uX * scatterDist,
          y: uY * scatterDist,
          z: uZ * scatterDist,
          size: 1.4 + Math.random() * 0.8,
          brightness: 0.85 + Math.random() * 0.15,
          delay: Math.random() * 0.35,
          isPolar: true,
        });
      }
    });

    stateRef.current.points = points;
    stateRef.current.startTime = performance.now();
    stateRef.current.formed = false;

    // Resize handling with devicePixelRatio for Retina crispness
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(rect.width * dpr, 300);
      canvas.height = Math.max(rect.height * dpr, 300);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    // Animation Loop
    let lastTime = performance.now();
    const FORMATION_DURATION = 1400; // ms to complete sphere formation

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const elapsed = time - stateRef.current.startTime;

      // Update formation interpolation
      stateRef.current.points.forEach((pt) => {
        const pElapsed = Math.max(0, elapsed - pt.delay * 1000);
        const progress = Math.min(1, pElapsed / FORMATION_DURATION);
        // Smooth cubic ease out
        const ease = 1 - Math.pow(1 - progress, 3);

        pt.x = pt.sX + (pt.uX - pt.sX) * ease;
        pt.y = pt.sY + (pt.uY - pt.sY) * ease;
        pt.z = pt.sZ + (pt.uZ - pt.sZ) * ease;
      });

      // Smooth continuous rotation around tilted axis
      stateRef.current.angleY += 0.45 * speed * dt;
      const angleY = stateRef.current.angleY;
      // Fixed 3D tilt: 18 deg tilt forward
      const tiltX = 0.28; // ~16 degrees tilt towards viewer

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const sphereRadius = Math.min(w, h) * 0.36;

      ctx.clearRect(0, 0, w, h);

      // Project 3D points
      interface Projected {
        px: number;
        py: number;
        pz: number;
        size: number;
        alpha: number;
        isPolar?: boolean;
      }
      const projected: Projected[] = [];

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);

      for (let i = 0; i < stateRef.current.points.length; i++) {
        const pt = stateRef.current.points[i];

        // 1. Rotate around Y axis
        const x1 = pt.x * cosY - pt.z * sinY;
        const z1 = pt.x * sinY + pt.z * cosY;
        const y1 = pt.y;

        // 2. Tilt around X axis
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        // Perspective
        const fov = 3.5;
        const scale = fov / (fov + z2);
        const px = cx + x2 * sphereRadius * scale;
        const py = cy + y2 * sphereRadius * scale;

        // Depth-based alpha and scale
        // z2 is in [-1, 1] for unit sphere
        const depthNorm = (z2 + 1) / 2; // 0 (back) to 1 (front)
        const alpha = Math.max(0.12, Math.min(1.0, 0.18 + depthNorm * 0.82 * pt.brightness));
        const dotSize = Math.max(0.8, pt.size * scale * (0.7 + depthNorm * 0.5));

        projected.push({
          px,
          py,
          pz: z2,
          size: dotSize,
          alpha,
          isPolar: pt.isPolar,
        });
      }

      // Sort back-to-front for proper depth layering
      projected.sort((a, b) => a.pz - b.pz);

      // Render points
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.fillStyle = `rgba(244, 38, 1, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra subtle bloom on close/prominent polar points
        if (p.isPolar && p.pz > 0.3) {
          ctx.fillStyle = `rgba(255, 90, 60, ${p.alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [speed, color]);

  // When step becomes active, reset start time to trigger formation if desired
  useEffect(() => {
    if (active) {
      stateRef.current.startTime = performance.now();
    }
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
