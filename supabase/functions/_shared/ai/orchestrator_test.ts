import { validateAgentResponse } from "./response.ts";
import type { AgentContext } from "./types.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const taskId = "223e4567-e89b-42d3-a456-426614174000";
const projectId = "323e4567-e89b-42d3-a456-426614174000";

const context: AgentContext = {
  user: {
    id: userId,
    profile: {
      fullName: "Test User",
      timezone: "UTC",
      jobTitle: "",
      organization: "",
      department: "",
      skills: [],
    },
  },
  workspaces: [],
  projects: [{
    id: projectId,
    name: "Authorized project",
    description: "",
    status: "active",
    startDate: null,
    dueDate: null,
    workspaceId: null,
    ownerId: userId,
  }],
  projectMembership: [{ projectId, userId, role: "owner" }],
  assignedTasks: [{
    id: taskId,
    projectId,
    title: "Review roadmap",
    description: "",
    status: "todo",
    priority: "medium",
    dueAt: null,
    createdAt: "2026-10-04T00:00:00.000Z",
  }],
  taskDependencies: [],
  currentTask: null,
  taskActivity: [],
  notifications: [],
  meetings: [],
  calendarEvents: [],
  conversationHistory: [],
  currentTime: "2026-10-04T00:00:00.000Z",
};

const response = {
  agent: "personal_assistant",
  message: "Start with the roadmap review.",
  recommendations: [],
  plan: null,
  taskPlan: null,
  insights: [],
  review: null,
  proposedActions: [],
};

Deno.test("validates a structured assistant response", () => {
  const result = validateAgentResponse(response, "personal_assistant", context);
  if (
    result.agent !== "personal_assistant" || result.recommendations.length !== 0
  ) {
    throw new Error("Structured assistant response did not pass validation.");
  }
});

Deno.test("rejects task recommendations outside the authorized context", () => {
  let rejected = false;
  try {
    validateAgentResponse(
      {
        ...response,
        recommendations: [{
          taskId: "423e4567-e89b-42d3-a456-426614174000",
          title: "Private task",
          reason: "Model-generated",
          priority: "high",
          dueAt: null,
        }],
      },
      "personal_assistant",
      context,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("An unauthorized task recommendation was accepted.");
  }
});

Deno.test("rejects tool proposals for tasks outside the authorized context", () => {
  let rejected = false;
  try {
    validateAgentResponse(
      {
        ...response,
        proposedActions: [{
          tool: "update_task_status",
          arguments: {
            task_id: "423e4567-e89b-42d3-a456-426614174000",
            status: "completed",
          },
          requiresApproval: true,
        }],
      },
      "personal_assistant",
      context,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("A tool proposal for an unauthorized task was accepted.");
  }
});

Deno.test("requires user approval on every tool proposal", () => {
  let rejected = false;
  try {
    validateAgentResponse(
      {
        ...response,
        proposedActions: [{
          tool: "update_task_status",
          arguments: { task_id: taskId, status: "completed" },
          requiresApproval: false,
        }],
      },
      "personal_assistant",
      context,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("A tool proposal without approval was accepted.");
  }
});

Deno.test("validates a task plan suggestion and dependency order", () => {
  const result = validateAgentResponse(
    {
      ...response,
      agent: "task_planner",
      taskPlan: {
        title: "Calendar integration",
        summary: "Implement and verify calendar sync.",
        priority: "high",
        estimatedHours: 8,
        subtasks: [
          {
            title: "Configure OAuth",
            description: "",
            estimatedHours: 1,
            priority: "high",
            dependencies: [],
          },
          {
            title: "Implement sync",
            description: "",
            estimatedHours: 5,
            priority: "high",
            dependencies: [0],
          },
        ],
        risks: ["OAuth provider configuration may vary."],
        recommendedOrder: [0, 1],
      },
    },
    "task_planner",
    context,
  );
  if (result.taskPlan?.subtasks[1].dependencies[0] !== 0) {
    throw new Error("Task plan dependencies were not preserved.");
  }
});

Deno.test("rejects a task plan with a forward or self dependency", () => {
  let rejected = false;
  try {
    validateAgentResponse(
      {
        ...response,
        agent: "task_planner",
        taskPlan: {
          title: "Calendar integration",
          summary: "Implement and verify calendar sync.",
          priority: "high",
          estimatedHours: 8,
          subtasks: [
            {
              title: "Configure OAuth",
              description: "",
              estimatedHours: 1,
              priority: "high",
              dependencies: [0],
            },
          ],
          risks: [],
          recommendedOrder: [0],
        },
      },
      "task_planner",
      context,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Invalid task dependency was accepted.");
});
