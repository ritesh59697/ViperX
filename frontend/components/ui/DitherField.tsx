"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { usePathname } from "next/navigation";

/**
 * The site's one moving element: a slow-drifting noise field quantised through
 * an ordered (Bayer) dither, rendered to a deliberately undersized canvas and
 * scaled back up with `image-rendering: pixelated`.
 *
 * That undersizing is the whole effect — it's what turns a smooth gradient into
 * chunky pixels. Rendering at device resolution and trying to draw "pixels" as
 * quads would cost far more and look worse.
 *
 * It is `position: fixed` behind everything, so it reads as the page's actual
 * background on every route rather than as a decoration on one section.
 */

/** CSS pixels per rendered texel. Higher = chunkier blocks and less GPU work. */
const DEFAULT_TEXEL_SIZE = 2.5;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uBg;
uniform vec3  uInk;
uniform float uStrength;
uniform float uLeftBias;
uniform vec2  uBiasRamp;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// Compact ordered-dither thresholds — the classic recursive Bayer trick, which
// avoids needing a lookup array (WebGL1 can't index one dynamically).
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a)  (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a)  (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;

  // Correct for aspect so the field isn't stretched on wide viewports.
  // Low frequency on purpose: this wants to read as drifting cloud, not as
  // television static, and static is what a high frequency gives you.
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.35;

  // Two layers drifting at different rates keeps it from looking like a
  // single texture being panned.
  float n = fbm(p + vec2(uTime * 0.017, uTime * -0.011));
  n += 0.5 * fbm(p * 1.9 - vec2(uTime * 0.012, uTime * 0.008));
  n /= 1.5;

  // Density lives at the top and drifts to the right, leaving the left-hand
  // content column — where every page starts its text — comparatively clear.
  float vertical = smoothstep(1.15, -0.05, uv.y);
  float horizontal = mix(uLeftBias, 1.0, smoothstep(uBiasRamp.x, uBiasRamp.y, uv.x));
  float shaped = clamp(n * vertical * horizontal, 0.0, 1.0);

  // The gamma is what creates genuine negative space: it pushes mid values
  // under the dither threshold entirely, so only the brightest cores of the
  // noise survive as pixels. Without it the field is evenly speckled and
  // body copy has to compete with it everywhere.
  float lum = pow(shaped, 2.6) * uStrength;

  float threshold = bayer8(frag);
  float bit = step(threshold, lum);

  gl_FragColor = vec4(mix(uBg, uInk, bit), 1.0);
}
`;

const FLUID_FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uBg;
uniform vec3  uInk;
uniform float uStrength;

uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform vec2  uMousePos;
uniform float uMouseRadius;
uniform float uColorNum;
uniform float uPixelSize;

// --- Perlin noise helpers ---
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

// --- 2D Classic Perlin noise ---
float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz, iy = Pi.yyww;
  vec4 fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x), g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z), g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

// --- fBm with ridged turbulence (abs) ---
float fbm(vec2 p) {
  float value = 0.0, amp = 1.0, freq = uWaveFrequency;
  for (int i = 0; i < 4; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= uWaveAmplitude;
  }
  return value;
}

// --- Domain-warped pattern ---
float pattern(vec2 p) {
  return fbm(p + fbm(p - uTime * uWaveSpeed));
}

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a)  (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a)  (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 pixelCoord = floor(frag / uPixelSize) * uPixelSize;

  vec2 uv = pixelCoord / uRes;
  uv -= 0.5;
  uv.x *= uRes.x / uRes.y;

  float f = pattern(uv);

  // Mouse interaction
  vec2 mouseNDC = uMousePos / uRes;
  mouseNDC -= 0.5;
  mouseNDC.x *= uRes.x / uRes.y;
  float dist = length(uv - mouseNDC);
  f -= 0.5 * (1.0 - smoothstep(0.0, uMouseRadius, dist));

  // Edge fade (bottom fade only)
  vec2 rawUV = pixelCoord / uRes;
  float edgeFade = smoothstep(0.0, 0.3, rawUV.y);
  f *= edgeFade;

  // Dither & Quantize the scalar field density
  float s = 1.0 / (uColorNum - 1.0);
  float threshold = bayer8(frag / uPixelSize) - 0.25;

  // Mix fluid density with a rich, cloudy color theme.
  // uStrength scales the field's density before it meets the dither threshold,
  // the same role it plays in the classic shader above. It was declared but
  // never read here, which silently made a palette's strength a no-op for
  // every fluid palette; 1.0 reproduces that old behaviour exactly.
  float ditheredF = f * 0.70 * uStrength + threshold * s;
  ditheredF = clamp(ditheredF - 0.30, 0.0, 1.0);
  float quantizedF = floor(ditheredF * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);

  vec3 col = mix(uBg, uInk, quantizedF);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** "#0a0a0b" -> [0.039, 0.039, 0.043] */
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export type DitherPalette = {
  bg: string;
  ink: string;
  strength: number;
  /**
   * Density multiplier at the far-left edge, ramping to 1.0 at the right.
   * Lower values clear more room for the text column, which every page starts
   * on the left. The hero needs a much lower value than the page field because
   * its ink is saturated and sits directly behind the lead paragraph.
   */
  leftBias?: number;
  /**
   * Where the left-to-right density ramp starts and ends, in normalised x.
   * Pushing the start rightward widens the clear zone under the text column —
   * the hero needs that because its copy runs further across the page.
   */
  biasRamp?: [number, number];
};
export type DitherPalettes = Record<"light" | "dark", DitherPalette>;

/** The quiet greyscale field that runs behind the whole site. */
export const PAGE_PALETTES: DitherPalettes = {
  // Dark ink on a near-white page. Light mode has less headroom — the same
  // density that reads as texture on black reads as dirt on white.
  light: { bg: "#f7f7f8", ink: "#fca5a5", strength: 1.0, leftBias: 0.42, biasRamp: [0.1, 0.95] },
  // Light ink on near-black can carry more before it competes with copy.
  dark: { bg: "#0a0a0b", ink: "#fe2e00", strength: 0.9, leftBias: 0.42, biasRamp: [0.1, 0.95] },
};

/**
 * Hero-only ember palette. Same shader, hotter ink — this is the one moment on
 * the site that gets colour, which is what makes it read as a feature rather
 * than as a theme. Backgrounds match PAGE_PALETTES exactly so the banner can be
 * masked into the page field with no visible seam.
 */
export const EMBER_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#fe2e00", strength: 3.2, leftBias: 0.03, biasRamp: [0.42, 1.05] },
  dark: { bg: "#0a0a0b", ink: "#fe2e00", strength: 3.8, leftBias: 0.03, biasRamp: [0.42, 1.05] },
};

/** Green/Solana developer theme */
export const GREEN_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#10b981", strength: 3.2, leftBias: 0.03, biasRamp: [0.42, 1.05] },
  dark: { bg: "#0a0a0b", ink: "#14f195", strength: 3.8, leftBias: 0.03, biasRamp: [0.42, 1.05] },
};

/** Purple/Neon Indigo theme */
export const PURPLE_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#6366f1", strength: 3.2, leftBias: 0.03, biasRamp: [0.42, 1.05] },
  dark: { bg: "#0a0a0b", ink: "#9945ff", strength: 3.8, leftBias: 0.03, biasRamp: [0.42, 1.05] },
};

/** Blue/Cyan theme */
export const BLUE_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#3b82f6", strength: 3.2, leftBias: 0.03, biasRamp: [0.42, 1.05] },
  dark: { bg: "#0a0a0b", ink: "#00bcff", strength: 3.8, leftBias: 0.03, biasRamp: [0.42, 1.05] },
};

/**
 * Red/Ember global background palette — the landing page only (see
 * `GlobalDither`). Its strength is deliberately far below the other global
 * palettes': `/` is laid out on a visible hairline grid, and a field loud
 * enough to read as weather competes with those rules and with the monospace
 * copy sitting on top of them. It should register as texture, not as an image.
 */
export const GLOBAL_RED_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#fca5a5", strength: 0.72, leftBias: 0.42, biasRamp: [0.1, 0.95] },
  // Dark ink dimmed from the old #fe2e00 (near-neon, read as "disturbing" against
  // near-black) to a deeper, less saturated red, plus reduced strength — quieter
  // texture instead of a competing light source.
  dark: { bg: "#0a0a0b", ink: "#b3230f", strength: 0.45, leftBias: 0.42, biasRamp: [0.1, 0.95] },
};

/** Green global background palette. Strength matched to GLOBAL_RED_PALETTES so
 *  the leaderboard's table and stats stay legible over it — texture, not image. */
export const GLOBAL_GREEN_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#a7f3d0", strength: 0.72, leftBias: 0.42, biasRamp: [0.1, 0.95] },
  // Dimmed the same way as GLOBAL_RED_PALETTES.dark — deeper, less saturated ink,
  // reduced strength — so every route's dark-mode dither reads as calm texture.
  dark: { bg: "#0a0a0b", ink: "#19ad6f", strength: 0.45, leftBias: 0.42, biasRamp: [0.1, 0.95] },
};

/** Purple global background palette. Strength matched to GLOBAL_RED_PALETTES so
 *  the create page's strategy cards and copy stay legible over it. */
export const GLOBAL_PURPLE_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#ddd6fe", strength: 0.72, leftBias: 0.42, biasRamp: [0.1, 0.95] },
  // Dimmed the same way as GLOBAL_RED_PALETTES.dark — deeper, less saturated ink,
  // reduced strength — so every route's dark-mode dither reads as calm texture.
  dark: { bg: "#0a0a0b", ink: "#7114e3", strength: 0.45, leftBias: 0.42, biasRamp: [0.1, 0.95] },
};

/** Blue global background palette. Strength matched to GLOBAL_RED_PALETTES so
 *  the agent-profile stat tiles and chart stay legible over it. */
export const GLOBAL_BLUE_PALETTES: DitherPalettes = {
  light: { bg: "#f7f7f8", ink: "#bfdbfe", strength: 0.72, leftBias: 0.42, biasRamp: [0.1, 0.95] },
  // Dimmed the same way as GLOBAL_RED_PALETTES.dark — deeper, less saturated ink,
  // reduced strength — so every route's dark-mode dither reads as calm texture.
  dark: { bg: "#0a0a0b", ink: "#1087b2", strength: 0.45, leftBias: 0.42, biasRamp: [0.1, 0.95] },
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`DitherField shader failed: ${log}`);
  }
  return shader;
}

export type DitherVariant = "classic" | "fluid";

export function DitherField({
  palettes = PAGE_PALETTES,
  texelSize = DEFAULT_TEXEL_SIZE,
  className = "pointer-events-none fixed inset-0 -z-10 h-full w-full",
  maskImage,
  fluid = false,
  variant,
  waveSpeed = 0.03,
  waveFrequency = 2.3,
  waveAmplitude = 0.44,
  colorNum = 4.3,
  pixelSize = 2.0,
  mouseRadius = 0.12,
}: {
  palettes?: DitherPalettes;
  texelSize?: number;
  /** Override to scope the field to a section instead of the whole viewport. */
  className?: string;
  /** CSS mask, e.g. to fade a hero banner into the page field beneath it. */
  maskImage?: string;
  /** @deprecated Prefer `variant="fluid"`. Kept so existing callers don't break. */
  fluid?: boolean;
  variant?: DitherVariant;
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  colorNum?: number;
  pixelSize?: number;
  mouseRadius?: number;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();

  // `variant` wins when given; otherwise fall back to the old boolean so every
  // existing call site keeps its current behaviour.
  const mode: DitherVariant = variant ?? (fluid ? "fluid" : "classic");

  // Read through refs so a theme flip re-paints without tearing down the
  // GL context and rebuilding the program.
  const paletteRef = useRef<DitherPalette>(palettes.dark);
  paletteRef.current = palettes[theme] ?? palettes.dark;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const texelRef = useRef(texelSize);
  texelRef.current = texelSize;

  // Wave/grain params are re-sent every frame in draw(), so holding them in refs
  // lets them animate without tearing down the GL context the way listing them
  // in the effect's dep array does.
  const paramsRef = useRef({
    waveSpeed,
    waveFrequency,
    waveAmplitude,
    colorNum,
    pixelSize,
    mouseRadius,
  });
  paramsRef.current = {
    waveSpeed,
    waveFrequency,
    waveAmplitude,
    colorNum,
    pixelSize,
    mouseRadius,
  };

  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let disposed = false;
    let initialized = false;

    // Shader uniform locations
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uBg: WebGLUniformLocation | null = null;
    let uInk: WebGLUniformLocation | null = null;
    let uStrength: WebGLUniformLocation | null = null;
    let uLeftBias: WebGLUniformLocation | null = null;
    let uBiasRamp: WebGLUniformLocation | null = null;
    let uWaveSpeed: WebGLUniformLocation | null = null;
    let uWaveFrequency: WebGLUniformLocation | null = null;
    let uWaveAmplitude: WebGLUniformLocation | null = null;
    let uMousePos: WebGLUniformLocation | null = null;
    let uMouseRadius: WebGLUniformLocation | null = null;
    let uColorNum: WebGLUniformLocation | null = null;
    let uPixelSize: WebGLUniformLocation | null = null;
    let start = 0;

    function initGL() {
      if (initialized || disposed) return;

      gl = canvas!.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });

      if (!gl) return;

      try {
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const source = mode === "fluid" ? FLUID_FRAG : FRAG;
        const fs = compile(gl, gl.FRAGMENT_SHADER, source);
        program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
        }
      } catch (err) {
        console.warn("[DitherField] disabled:", err);
        return;
      }

      gl.useProgram(program);

      // One full-screen triangle pair.
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const isFluid = mode === "fluid";

      uRes = gl.getUniformLocation(program, "uRes");
      uTime = gl.getUniformLocation(program, "uTime");
      uStrength = gl.getUniformLocation(program, "uStrength");
      uBg = gl.getUniformLocation(program, "uBg");
      uInk = gl.getUniformLocation(program, "uInk");

      uLeftBias = !isFluid ? gl.getUniformLocation(program, "uLeftBias") : null;
      uBiasRamp = !isFluid ? gl.getUniformLocation(program, "uBiasRamp") : null;

      uWaveSpeed = isFluid ? gl.getUniformLocation(program, "uWaveSpeed") : null;
      uWaveFrequency = isFluid ? gl.getUniformLocation(program, "uWaveFrequency") : null;
      uWaveAmplitude = isFluid ? gl.getUniformLocation(program, "uWaveAmplitude") : null;
      uMousePos = isFluid ? gl.getUniformLocation(program, "uMousePos") : null;
      uMouseRadius = isFluid ? gl.getUniformLocation(program, "uMouseRadius") : null;
      uColorNum = isFluid ? gl.getUniformLocation(program, "uColorNum") : null;
      uPixelSize = isFluid ? gl.getUniformLocation(program, "uPixelSize") : null;

      start = performance.now();
      initialized = true;

      resize();
      frame = requestAnimationFrame(loop);
    }

    let isVisible = false;
    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = entry.isIntersecting;
              if (isVisible && !initialized) {
                initGL();
              }
            },
            { threshold: 0.0 }
          )
        : null;
    intersectionObserver?.observe(canvas);

    // Fallback: If IntersectionObserver is not supported, initialize immediately.
    if (!intersectionObserver) {
      initGL();
    }

    // Sized from the element's own box, rounded to prevent frequent WebGL context
    // rebuilds when the container height shifts due to dynamic list items updates.
    function resize() {
      if (!initialized || !gl) return;
      const texel = texelRef.current;
      const rawW = canvas!.clientWidth || window.innerWidth;
      const rawH = canvas!.clientHeight || window.innerHeight;
      
      const roundedW = Math.max(1, Math.ceil(rawW / 64) * 64);
      const roundedH = Math.max(1, Math.ceil(rawH / 64) * 64);

      const w = Math.max(1, Math.ceil(roundedW / texel));
      const h = Math.max(1, Math.ceil(roundedH / texel));
      if (canvas!.width === w && canvas!.height === h) return;
      canvas!.width = w;
      canvas!.height = h;
      gl.viewport(0, 0, w, h);
    }

    function draw(timeSeconds: number) {
      if (!initialized || !gl) return;
      const p = paramsRef.current;

      gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.uniform1f(uTime, timeSeconds);

      const { bg, ink, strength } = paletteRef.current;
      gl.uniform1f(uStrength, strength);
      if (uBg) gl.uniform3fv(uBg, hexToRgb(bg));
      if (uInk) gl.uniform3fv(uInk, hexToRgb(ink));

      if (mode === "classic") {
        const { leftBias = 0.42, biasRamp = [0.1, 0.95] } = paletteRef.current;
        if (uLeftBias) gl.uniform1f(uLeftBias, leftBias);
        if (uBiasRamp) gl.uniform2f(uBiasRamp, biasRamp[0], biasRamp[1]);
      } else {
        if (uWaveSpeed) gl.uniform1f(uWaveSpeed, p.waveSpeed);
        if (uWaveFrequency) gl.uniform1f(uWaveFrequency, p.waveFrequency);
        if (uWaveAmplitude) gl.uniform1f(uWaveAmplitude, p.waveAmplitude);
        if (uMousePos) gl.uniform2f(uMousePos, mouseRef.current.x, mouseRef.current.y);
        if (uMouseRadius) gl.uniform1f(uMouseRadius, p.mouseRadius);
        if (uColorNum) gl.uniform1f(uColorNum, p.colorNum);
        if (uPixelSize) gl.uniform1f(uPixelSize, p.pixelSize);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    let lastPalette = "";

    function loop(now: number) {
      if (disposed || !initialized) return;

      if (reducedRef.current) {
        // Hold a single static frame, but keep watching for a theme change.
        const key = JSON.stringify(paletteRef.current);
        if (key !== lastPalette) {
          lastPalette = key;
          resize();
          draw(0);
        }
      } else if (isVisible) {
        draw((now - start) / 1000);
      }
      frame = requestAnimationFrame(loop);
    }

    // rAF already stops while the tab is hidden; this repaints immediately on
    // return so the first visible frame isn't a stale one.
    function onVisible() {
      if (!document.hidden && !disposed && isVisible && initialized) {
        draw((performance.now() - start) / 1000);
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = rect.bottom - e.clientY;
      mouseRef.current = { x, y };
    };

    const wantsMouse = mode !== "classic";
    if (wantsMouse) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("resize", resize);
      if (wantsMouse) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
      if (initialized && gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
    // Only `mode` belongs here — it selects the shader source, so changing it
    // genuinely needs a rebuild. Every other param is re-sent each frame from
    // paramsRef, so listing them would tear down and recreate the GL context on
    // each tweak (and make animating them impossible).
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ imageRendering: "pixelated", maskImage, WebkitMaskImage: maskImage }}
    />
  );
}

export function GlobalDither() {
  const pathname = usePathname();

  if (pathname === "/serene") {
    return null;
  }

  // Route-specific 50% color / 50% black fluid dither backgrounds
  let palettes = GLOBAL_RED_PALETTES;
  
  if (pathname === "/") {
    palettes = GLOBAL_RED_PALETTES;      // Red for Landing Page
  } else if (pathname === "/leaderboard") {
    palettes = GLOBAL_GREEN_PALETTES;    // Green for Leaderboard
  } else if (pathname === "/create") {
    palettes = GLOBAL_PURPLE_PALETTES;   // Purple for Deploy/Create
  } else if (pathname.startsWith("/agents/")) {
    palettes = GLOBAL_BLUE_PALETTES;     // Blue for Agent detail page
  }

  return (
    <DitherField
      palettes={palettes}
      fluid={true}
      pixelSize={2.0}
      texelSize={1}
      waveSpeed={0.012}
      waveFrequency={2.0}
      waveAmplitude={0.4}
    />
  );
}
