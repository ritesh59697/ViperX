import React from "react";
import { cn } from "@/lib/utils";

export type RuneIconName =
  | "arrows-arrow-down-left"
  | "arrows-arrow-down-right"
  | "arrows-arrow-down-to-line"
  | "arrows-arrow-down"
  | "arrows-arrow-left-right"
  | "arrows-arrow-left"
  | "arrows-arrow-right"
  | "arrows-arrow-up-down"
  | "arrows-arrow-up-from-line"
  | "arrows-arrow-up-left"
  | "arrows-arrow-up-right"
  | "arrows-arrow-up"
  | "arrows-chevron-down"
  | "arrows-chevron-left"
  | "arrows-chevron-right"
  | "arrows-chevron-up"
  | "arrows-rotate-cw"
  | "arrows-rotate-ccw"
  | "code-copy"
  | "code-terminal"
  | "code-link"
  | "documents-clipboard-list"
  | "documents-clipboard"
  | "identity-shield-check"
  | "identity-shield"
  | "identity-lock"
  | "indicators-check"
  | "indicators-circle-check"
  | "indicators-circle-alert"
  | "indicators-circle-x"
  | "indicators-triangle-alert"
  | "indicators-info"
  | "indicators-x"
  | "indicators-square-arrow-out-up-right"
  | "layouts-columns-3"
  | "layouts-grid-2x2"
  | "layouts-kanban"
  | "messaging-send"
  | "metrics-activity"
  | "metrics-chart-area"
  | "metrics-chart-bar"
  | "metrics-chart-line"
  | "metrics-trending-up"
  | "money-bitcoin"
  | "money-wallet"
  | "money-dollar-sign"
  | "schedule-clock"
  | "schedule-history"
  | "schedule-refresh-cw"
  | "tools-bell-off"
  | "tools-settings"
  | "tools-settings-2"
  | "tools-sliders-horizontal"
  | "tools-share-2"
  | "tools-sparkles"
  | (string & {});

interface RuneIconProps extends React.SVGProps<SVGSVGElement> {
  name: RuneIconName;
  styleVariant?: "normal" | "duotone" | "fill";
  className?: string;
}

export function RuneIcon({
  name,
  styleVariant = "normal",
  className,
  ...props
}: RuneIconProps) {
  const spritePath = `/sprites/${styleVariant}.svg#${name}`;

  return (
    <svg
      aria-hidden="true"
      className={cn("inline-block shrink-0 fill-none stroke-current", className)}
      viewBox="0 0 24 24"
      {...props}
    >
      <use href={spritePath} />
    </svg>
  );
}
