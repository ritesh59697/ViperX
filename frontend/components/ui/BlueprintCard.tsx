"use client";

import React, { useState } from "react";

interface BlueprintCardProps {
  title: string;
  description: string;
  category?: string;
  children?: React.ReactNode;
}

export function BlueprintCard({
  title,
  description,
  category = "FEATURE // SPEC",
  children,
}: BlueprintCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col justify-between overflow-hidden border border-border bg-background/90 p-6 transition-all duration-300 hover:border-border-strong sm:p-8"
    >
      {/* Top Technical Metadata */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-accent uppercase">
          {category}
        </span>
      </div>

      {/* Center 3D Interactive Illustration Slot */}
      <div className="relative my-6 flex h-[240px] w-full items-center justify-center sm:h-[280px]">
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ isHovered?: boolean }>, { isHovered })
          : children}
      </div>

      {/* Bottom Technical Spec Copy */}
      <div className="mt-auto border-t border-border/60 pt-5">
        <h3 className="font-sans text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-accent sm:text-xl">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}

export default BlueprintCard;
