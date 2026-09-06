"use client";

import { useEffect } from "react";

interface AgentNavSyncProps {
  agent: {
    name: string;
    agent_pda: string;
    is_paper?: boolean;
    status?: string;
  };
}

export function AgentNavSync({ agent }: AgentNavSyncProps) {
  useEffect(() => {
    if (!agent) return;
    const event = new CustomEvent("viperx-agent-profile-mounted", {
      detail: {
        name: agent.name,
        agentPda: agent.agent_pda,
        isPaper: agent.is_paper,
        status: agent.status,
      },
    });
    window.dispatchEvent(event);
  }, [agent]);

  return null;
}
