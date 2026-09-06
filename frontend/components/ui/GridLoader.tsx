import React from "react";

interface GridLoaderProps {
  size?: number | string;
  color?: string;
  className?: string;
  label?: string;
}

/**
 * 3x2 Blinking Grid Loader
 * From Uiverse.io by cosnametv
 */
export function GridLoader({
  size = 54,
  color = "var(--accent, #d0200a)",
  className = "",
  label,
}: GridLoaderProps) {
  const style: React.CSSProperties = {
    "--size": typeof size === "number" ? `${size}px` : size,
    "--color": color,
  } as React.CSSProperties;

  return (
    <div className={`flex flex-col items-center justify-center gap-3.5 ${className}`}>
      <div className="loader" style={style}>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {label && (
        <span className="font-mono text-xs text-foreground-muted tracking-wider animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
