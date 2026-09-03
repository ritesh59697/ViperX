"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "../motion/useReducedMotion";

// Symmetrical, futuristic ASCII silhouette template of Human and Agent profiles facing each other.
// Max length is 72 chars.
const TEMPLATE = [
  "             ___                                   ___                  ",
  "          .´     `.                             .´     `.               ",
  "         /   _.._  \\                           /  _.._   \\              ",
  "        |  .´    `. \\                         / /    `.  |              ",
  "        | /        \\ \\                       / /        \\ |              ",
  "        | |         |_|        · · · ·      |_|         | |              ",
  "       /  |       .-´ \\       (  * *  )    /  `-.       |  \\             ",
  "      |   |      /     |       · · · ·    |      \\      |   |            ",
  "      |   |     |      /                  \\      |      |   |            ",
  "      |    \\     `---·´                    `·---´      /    |            ",
  "       \\    `·._____.·´                     `·._____.·´    /             ",
  "        `.           \\                          /         /              ",
  "          `·.______.·´                        `·.______·´                "
];

export function HumanAgentAscii({ className = "" }: { className?: string }) {
  const preRef = useRef<HTMLPreElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    // Pad all lines to the maximum length to form a regular grid
    const maxLen = Math.max(...TEMPLATE.map((line) => line.length));
    const grid = TEMPLATE.map((line) => line.padEnd(maxLen, " "));
    const rows = grid.length;

    function render(time: number) {
      let html = "";

      // Pulse positions for the synapse connection sparks
      // Wave moving left-to-right (from human brain to agent core)
      const sparkX1 = 0.38 + 0.24 * ((time * 0.4) % 1.0);
      // Wave moving right-to-left (from agent core to human brain)
      const sparkX2 = 0.62 - 0.24 * ((time * 0.5) % 1.0);

      for (let r = 0; r < rows; r++) {
        const line = grid[r];
        for (let c = 0; c < maxLen; c++) {
          const char = line[c];

          // Skip space characters but preserve layout using standard text
          if (char === " ") {
            html += " ";
            continue;
          }

          // Normalized coordinate for horizontal position (0.0 to 1.0)
          const pctX = c / (maxLen - 1);

          // 1. HUMAN SIDE (Left 40% of columns)
          if (pctX < 0.40) {
            // Smooth, slow organic wave (simulates breathing/brain activity)
            const organicWave = Math.sin(pctX * 10 - time * 2.0 + r * 0.2);
            const opacity = 0.55 + 0.45 * organicWave;
            // Warm or default text color (human)
            html += `<span class="text-foreground-muted transition-all duration-200" style="opacity: ${opacity.toFixed(2)}">${char}</span>`;
          } 
          // 2. SYNAPSE BRIDGE (Center columns between 40% and 60%)
          else if (pctX >= 0.40 && pctX <= 0.60) {
            // Check if current column is near the spark wave positions
            const dist1 = Math.abs(pctX - sparkX1);
            const dist2 = Math.abs(pctX - sparkX2);
            const isSpark = dist1 < 0.025 || dist2 < 0.025;

            if (isSpark) {
              // Glowing node/spark traveler
              html += `<span class="text-foreground font-bold" style="text-shadow: 0 0 6px var(--accent-emerald)">${char}</span>`;
            } else {
              // Standard connection line
              const idleOpacity = 0.25 + 0.15 * Math.sin(time * 3.0 + r * 0.4 + c * 0.2);
              html += `<span class="text-accent-emerald" style="opacity: ${idleOpacity.toFixed(2)}">${char}</span>`;
            }
          } 
          // 3. AGENT SIDE (Right 40% of columns)
          else {
            // Dynamic glitch effect: occasionally swap characters with binary or digital glyphs
            let displayChar = char;
            
            // 2% chance per frame to glitch if it's not a standard frame bracket
            if (!reduced && Math.random() < 0.02 && char !== "(" && char !== ")" && char !== "/" && char !== "\\") {
              displayChar = Math.random() > 0.5 ? "1" : "0";
            }

            // Tech wave: fast vertical scrolling dither wave
            const techWave = Math.sin(r * 0.6 - time * 4.0 + c * 0.1);
            const opacity = 0.6 + 0.4 * techWave;

            html += `<span class="text-accent" style="opacity: ${opacity.toFixed(2)}">${displayChar}</span>`;
          }
        }
        html += "\n";
      }

      el!.innerHTML = html;
    }

    if (reduced) {
      render(1.0);
      return;
    }

    let raf = 0;
    let last = 0;
    const start = performance.now();

    function loop(now: number) {
      // Throttle to ~16 FPS (every 60ms) to ensure smooth performance and typewriter/retro look
      if (now - last > 60) {
        render((now - start) / 1000);
        last = now;
      }
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <pre
      ref={preRef}
      aria-hidden
      className={`select-none font-mono leading-[1.0] tracking-normal ${className}`}
      style={{ fontVariantLigatures: "none" }}
    />
  );
}
