"use client";

import dynamic from "next/dynamic";

// Dynamically loaded with ssr: false inside a client component — valid in Next.js.
const TransitionToDevnetPanel = dynamic(
  () =>
    import("./TransitionToDevnetPanel").then((m) => m.TransitionToDevnetPanel),
  { ssr: false, loading: () => null }
);

export function TransitionToDevnetPanelLazy(props: {
  agentPda: string;
  chain: string;
}) {
  return <TransitionToDevnetPanel {...props} />;
}
