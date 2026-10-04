import { MAX_RECOMMENDATIONS } from "./config.ts";
import { validateToolProposal } from "./tools.ts";
import type {
  AgentContext,
  AgentName,
  AgentResponse,
  ProjectInsight,
  ReviewReport,
  TaskPlan,
  TaskPlanSuggestion,
  TaskRecommendation,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= maxLength;
}

function validatePlan(value: unknown): TaskPlan | null {
  if (value === null) return null;
  if (
    !isRecord(value) || !requireText(value.title, 200) ||
    !Array.isArray(value.steps) ||
    value.steps.length > 12 ||
    !value.steps.every((step) => requireText(step, 300)) ||
    !requireText(value.rationale, 1000)
  ) {
    throw new Error("AI returned an invalid task plan.");
  }
  return {
    title: value.title.trim(),
    steps: value.steps.map((step) => step.trim()),
    rationale: value.rationale.trim(),
  };
}

function validateTaskPlan(value: unknown): TaskPlanSuggestion | null {
  if (value === null) return null;
  if (
    !isRecord(value) || !requireText(value.title, 200) ||
    !requireText(value.summary, 2000) ||
    !["low", "medium", "high", "urgent"].includes(String(value.priority)) ||
    typeof value.estimatedHours !== "number" ||
    !Number.isFinite(value.estimatedHours) ||
    value.estimatedHours <= 0 || value.estimatedHours > 1000 ||
    !Array.isArray(value.subtasks) || value.subtasks.length > 20 ||
    !Array.isArray(value.risks) || value.risks.length > 10 ||
    !value.risks.every((risk) => requireText(risk, 500)) ||
    !Array.isArray(value.recommendedOrder) ||
    value.recommendedOrder.length !== value.subtasks.length
  ) {
    throw new Error("AI returned an invalid task plan.");
  }

  const indices = new Set<number>();
  const subtasks = value.subtasks.map((subtask, index) => {
    if (
      !isRecord(subtask) || !requireText(subtask.title, 200) ||
      typeof subtask.description !== "string" ||
      subtask.description.length > 2000 ||
      typeof subtask.estimatedHours !== "number" ||
      !Number.isFinite(subtask.estimatedHours) ||
      subtask.estimatedHours <= 0 || subtask.estimatedHours > 1000 ||
      !["low", "medium", "high", "urgent"].includes(String(subtask.priority)) ||
      !Array.isArray(subtask.dependencies) ||
      subtask.dependencies.length > 20 ||
      !subtask.dependencies.every((dependency) =>
        Number.isInteger(dependency) && dependency >= 0 && dependency < index
      )
    ) {
      throw new Error("AI returned an invalid task plan.");
    }
    const dependencies = new Set(subtask.dependencies);
    if (dependencies.size !== subtask.dependencies.length) {
      throw new Error("AI returned an invalid task plan.");
    }
    return {
      title: subtask.title.trim(),
      description: subtask.description.trim(),
      estimatedHours: subtask.estimatedHours,
      priority: subtask.priority as TaskPlanSuggestion["priority"],
      dependencies: [...dependencies],
    };
  });
  const recommendedOrder = value.recommendedOrder as unknown[];
  if (
    !recommendedOrder.every((item) =>
      typeof item === "number" && Number.isInteger(item) && item >= 0 &&
      item < subtasks.length
    ) ||
    new Set(recommendedOrder).size !== subtasks.length
  ) {
    throw new Error("AI returned an invalid task plan.");
  }
  const orderPosition = new Map(
    (recommendedOrder as number[]).map((item, position) => [item, position]),
  );
  if (
    subtasks.some((subtask, index) =>
      subtask.dependencies.some((dependency) =>
        (orderPosition.get(dependency) ?? Number.MAX_SAFE_INTEGER) >=
          (orderPosition.get(index) ?? -1)
      )
    )
  ) {
    throw new Error("AI returned an invalid task plan.");
  }

  return {
    title: value.title.trim(),
    summary: value.summary.trim(),
    priority: value.priority as TaskPlanSuggestion["priority"],
    estimatedHours: value.estimatedHours,
    subtasks,
    risks: value.risks.map((risk) => risk.trim()),
    recommendedOrder: recommendedOrder as number[],
  };
}

function validateInsight(
  value: unknown,
  projectIds: Set<string>,
): ProjectInsight {
  if (
    !isRecord(value) ||
    (value.projectId !== null &&
      (typeof value.projectId !== "string" ||
        !projectIds.has(value.projectId))) ||
    !requireText(value.title, 200) || !requireText(value.detail, 1000) ||
    !["info", "warning", "high"].includes(String(value.severity))
  ) {
    throw new Error("AI returned an invalid project insight.");
  }
  return {
    projectId: value.projectId as string | null,
    title: value.title.trim(),
    detail: value.detail.trim(),
    severity: value.severity as ProjectInsight["severity"],
  };
}

function validateReview(value: unknown): ReviewReport | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !["ready", "needs_attention", "blocked"].includes(String(value.status)) ||
    !requireText(value.summary, 1000) || !Array.isArray(value.findings) ||
    value.findings.length > 20 ||
    !value.findings.every((finding) => requireText(finding, 500))
  ) {
    throw new Error("AI returned an invalid review report.");
  }
  return {
    status: value.status as ReviewReport["status"],
    summary: value.summary.trim(),
    findings: value.findings.map((finding) => finding.trim()),
  };
}

function validateRecommendation(
  value: unknown,
  context: AgentContext,
): TaskRecommendation {
  const taskIds = new Set([
    ...context.assignedTasks.map((task) => task.id),
    ...(context.currentTask ? [context.currentTask.id] : []),
  ]);
  if (
    !isRecord(value) ||
    (value.taskId !== null &&
      (typeof value.taskId !== "string" || !taskIds.has(value.taskId))) ||
    !requireText(value.title, 200) || !requireText(value.reason, 500) ||
    (value.priority !== null &&
      !["low", "medium", "high"].includes(String(value.priority))) ||
    (value.dueAt !== null &&
      (typeof value.dueAt !== "string" ||
        Number.isNaN(Date.parse(value.dueAt))))
  ) {
    throw new Error("AI returned an invalid task recommendation.");
  }
  return {
    taskId: value.taskId as string | null,
    title: value.title.trim(),
    reason: value.reason.trim(),
    priority: value.priority as TaskRecommendation["priority"],
    dueAt: value.dueAt as string | null,
  };
}

export function validateAgentResponse(
  value: unknown,
  expectedAgent: AgentName,
  context: AgentContext,
): AgentResponse {
  if (
    !isRecord(value) || value.agent !== expectedAgent ||
    !requireText(value.message, 3000) ||
    !Array.isArray(value.recommendations) ||
    value.recommendations.length > MAX_RECOMMENDATIONS ||
    !Array.isArray(value.insights) || value.insights.length > 10 ||
    !Array.isArray(value.proposedActions) || value.proposedActions.length > 5
  ) {
    throw new Error("AI returned an invalid structured response.");
  }

  const visibleProjectIds = new Set(
    context.projects.map((project) => project.id),
  );
  const taskPlan = validateTaskPlan(value.taskPlan);
  if (
    (expectedAgent === "task_planner" &&
      (!taskPlan || value.plan !== null || value.recommendations.length ||
        value.insights.length || value.review !== null ||
        value.proposedActions.length)) ||
    (expectedAgent === "personal_assistant" && taskPlan)
  ) {
    throw new Error("AI returned an invalid structured response.");
  }
  return {
    agent: expectedAgent,
    message: value.message.trim(),
    recommendations: value.recommendations.map((item) =>
      validateRecommendation(item, context)
    ),
    plan: validatePlan(value.plan),
    taskPlan,
    insights: value.insights.map((item) =>
      validateInsight(item, visibleProjectIds)
    ),
    review: validateReview(value.review),
    proposedActions: value.proposedActions.map((item) =>
      validateToolProposal(item, context)
    ),
  };
}
