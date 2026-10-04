import { buildDailyPlan } from "./dailyPlan.ts";
import type { AgentContext } from "./types.ts";

const context: AgentContext = {
  user: {
    id: "123e4567-e89b-42d3-a456-426614174000",
    profile: {
      fullName: "Test",
      timezone: "UTC",
      jobTitle: "",
      organization: "",
      department: "",
      skills: [],
    },
  },
  workspaces: [],
  projects: [],
  projectMembership: [],
  assignedTasks: [
    {
      id: "223e4567-e89b-42d3-a456-426614174000",
      projectId: null,
      title: "Overdue urgent",
      description: "",
      status: "todo",
      priority: "urgent",
      dueAt: "2026-10-03T10:00:00.000Z",
      createdAt: "2026-10-01T10:00:00.000Z",
    },
    {
      id: "323e4567-e89b-42d3-a456-426614174000",
      projectId: null,
      title: "Review waiting",
      description: "",
      status: "in_review",
      priority: "high",
      dueAt: "2026-10-05T10:00:00.000Z",
      createdAt: "2026-10-02T10:00:00.000Z",
    },
    {
      id: "423e4567-e89b-42d3-a456-426614174000",
      projectId: null,
      title: "Future task",
      description: "",
      status: "todo",
      priority: "low",
      dueAt: "2026-10-20T10:00:00.000Z",
      createdAt: "2026-10-03T10:00:00.000Z",
    },
  ],
  taskDependencies: [],
  currentTask: null,
  taskActivity: [],
  notifications: [],
  meetings: [],
  calendarEvents: [],
  conversationHistory: [],
  currentTime: "2026-10-04T12:00:00.000Z",
};

Deno.test("daily plan prioritizes actual overdue high-priority work and separates review tasks", () => {
  const result = buildDailyPlan(context);
  if (
    result.priorities[0]?.taskId !== context.assignedTasks[0].id ||
    result.overdueTasks.length !== 1 ||
    result.reviewTasks[0]?.taskId !== context.assignedTasks[1].id ||
    result.estimatedWorkloadHours !== 3
  ) {
    throw new Error(
      "Daily plan did not reflect the deterministic task context.",
    );
  }
});
