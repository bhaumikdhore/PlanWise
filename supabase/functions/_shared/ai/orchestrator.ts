import { MAX_AGENT_MESSAGE_LENGTH } from "./config.ts";
import { generateStructuredResponse } from "./gemini.ts";
import { validateAgentResponse } from "./response.ts";
import { agentNames } from "./types.ts";
import type {
  AgentContext,
  AgentName,
  AgentRequest,
  AgentResponse,
} from "./types.ts";

interface AgentDefinition {
  name: AgentName;
  enabled: boolean;
  purpose: string;
}

export const agentRegistry: Record<AgentName, AgentDefinition> = {
  personal_assistant: {
    name: "personal_assistant",
    enabled: true,
    purpose:
      "Answer personal planning questions using the authenticated user context.",
  },
  task_planner: {
    name: "task_planner",
    enabled: true,
    purpose: "Create reviewable task breakdowns without performing mutations.",
  },
  task_coach: {
    name: "task_coach",
    enabled: false,
    purpose: "Coach users through task execution.",
  },
  project_intelligence: {
    name: "project_intelligence",
    enabled: false,
    purpose: "Summarize project signals and risks.",
  },
  review_agent: {
    name: "review_agent",
    enabled: false,
    purpose: "Review work against explicit user criteria.",
  },
  project_coordinator: {
    name: "project_coordinator",
    enabled: false,
    purpose: "Coordinate approved project actions.",
  },
};

export async function orchestrateAgent(
  request: AgentRequest,
  context: AgentContext,
): Promise<AgentResponse> {
  const agentName = request.agent || "personal_assistant";
  if (!agentNames.includes(agentName)) {
    throw new Error("Unknown Planwise AI agent.");
  }
  const agent = agentRegistry[agentName];
  if (!agent.enabled) {
    throw new Error(`The ${agentName} agent is not enabled yet.`);
  }
  if (
    !request.message.trim() || request.message.length > MAX_AGENT_MESSAGE_LENGTH
  ) {
    throw new Error("AI request message is invalid.");
  }

  if (agentName === "task_planner" && !request.message.trim()) {
    throw new Error("Describe the task you want to plan.");
  }
  const output = await generateStructuredResponse(
    request.message,
    context,
    agentName,
  );
  return validateAgentResponse(output, agentName, context);
}
