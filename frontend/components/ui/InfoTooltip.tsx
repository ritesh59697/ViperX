import React from "react";

export function InfoTooltip({ 
  content, 
  position = "top",
  align = "center"
}: { 
  content: React.ReactNode;
  position?: "top" | "bottom";
  align?: "left" | "center" | "right";
}) {
  // Horizontal alignment classes for the tooltip container
  const alignClasses = {
    left: "left-0",
    center: "left-1/2 -translate-x-1/2",
    right: "right-0"
  };

  // Horizontal alignment classes for the little triangle arrow
  const arrowClasses = {
    left: "left-2",
    center: "left-1/2 -translate-x-1/2",
    right: "right-2"
  };

  return (
    <button type="button" tabIndex={0} className="group relative inline-flex items-center justify-center cursor-help focus:outline-none">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground-faint hover:text-foreground-muted transition-colors"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      
      {/* Tooltip content */}
      <div 
        className={`pointer-events-none absolute z-50 w-max max-w-[250px] sm:max-w-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${
          position === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${alignClasses[align]}`}
      >
        <div className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-50 shadow-md dark:bg-neutral-100 dark:text-neutral-900 font-sans text-left">
          {content}
        </div>
        {/* Triangle arrow */}
        <div 
          className={`absolute h-0 w-0 border-4 border-transparent ${
            position === "top" 
              ? "top-full border-t-neutral-900 dark:border-t-neutral-100" 
              : "bottom-full border-b-neutral-900 dark:border-b-neutral-100"
          } ${arrowClasses[align]}`} 
        />
      </div>
    </button>
  );
}
