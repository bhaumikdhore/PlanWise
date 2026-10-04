import type { AgentContext, DailyPlan, TaskRecommendation } from "./types.ts";

function dateInTimezone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function recommendation(
  task: AgentContext["assignedTasks"][number],
  context: AgentContext,
  overdue: boolean,
): TaskRecommendation {
  const reasons = [`${task.priority} priority`];
  if (task.dueAt) {
    reasons.push(
      overdue
        ? "past its deadline"
        : `due ${new Date(task.dueAt).toLocaleDateString()}`,
    );
  }
  const project = context.projects.find((item) => item.id === task.projectId);
  if (project) {
    reasons.push(`${project.name} (${project.status.replaceAll("_", " ")})`);
  }
  const blockedBy = context.taskDependencies.filter((dependency) =>
    dependency.taskId === task.id &&
    dependency.dependsOnStatus !== "completed"
  );
  if (blockedBy.length || task.status === "blocked") {
    reasons.push(
      blockedBy.length
        ? `waiting on ${
          blockedBy.map((dependency) => dependency.dependsOnTitle).join(", ")
        }`
        : "blocked by unfinished work",
    );
  }
  return {
    taskId: task.id,
    title: task.title,
    reason: reasons.join(" · "),
    priority: task.priority,
    dueAt: task.dueAt,
  };
}

export function buildDailyPlan(context: AgentContext): DailyPlan {
  const now = new Date(context.currentTime);
  const today = dateInTimezone(now, context.user.profile.timezone || "UTC");
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endOfWeek = dateInTimezone(
    weekEnd,
    context.user.profile.timezone || "UTC",
  );
  const tasks = context.assignedTasks;
  const openTasks = tasks.filter((task) =>
    ["todo", "in_progress", "blocked"].includes(task.status)
  );
  const blockedByDependencies = (taskId: string) =>
    context.taskDependencies.some((dependency) =>
      dependency.taskId === taskId &&
      dependency.dependsOnStatus !== "completed"
    );
  const priorityScore: Record<string, number> = {
    urgent: 40,
    high: 30,
    medium: 20,
    low: 10,
  };
  const projectScore: Record<string, number> = {
    active: 15,
    planning: 3,
    on_hold: -30,
    completed: -100,
  };
  const dueScore = (dueAt: string | null) => {
    if (!dueAt) return 0;
    const dueDate = dateInTimezone(
      new Date(dueAt),
      context.user.profile.timezone || "UTC",
    );
    if (dueDate < today) return 100;
    if (dueDate === today) return 80;
    if (dueDate <= endOfWeek) return 50;
    return 0;
  };
  const score = (task: AgentContext["assignedTasks"][number]) => {
    const project = context.projects.find((item) => item.id === task.projectId);
    return (priorityScore[task.priority] || 0) +
      dueScore(task.dueAt) +
      (project ? projectScore[project.status] || 0 : 0) +
      (task.status === "in_progress" ? 8 : 0) -
      (task.status === "blocked" || blockedByDependencies(task.id) ? 100 : 0);
  };
  const orderedOpen = [...openTasks].sort((left, right) =>
    score(right) - score(left) ||
    (left.dueAt || "9999").localeCompare(right.dueAt || "9999") ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
  const overdue = openTasks
    .filter((task) =>
      task.dueAt &&
      dateInTimezone(
          new Date(task.dueAt),
          context.user.profile.timezone || "UTC",
        ) < today
    )
    .sort((left, right) => score(right) - score(left));
  const upcoming = openTasks
    .filter((task) =>
      task.dueAt &&
      dateInTimezone(
          new Date(task.dueAt),
          context.user.profile.timezone || "UTC",
        ) >= today &&
      dateInTimezone(
          new Date(task.dueAt),
          context.user.profile.timezone || "UTC",
        ) <= endOfWeek
    )
    .sort((left, right) => score(right) - score(left));
  const reviewTasks = tasks.filter((task) => task.status === "in_review");
  const suggestedTask =
    orderedOpen.find((task) =>
      task.status !== "blocked" && !blockedByDependencies(task.id)
    ) || null;

  return {
    priorities: orderedOpen.slice(0, 3).map((task) =>
      recommendation(
        task,
        context,
        Boolean(
          task.dueAt &&
            dateInTimezone(
                new Date(task.dueAt),
                context.user.profile.timezone || "UTC",
              ) < today,
        ),
      )
    ),
    overdueTasks: overdue.slice(0, 10).map((task) =>
      recommendation(task, context, true)
    ),
    upcomingDeadlines: upcoming.slice(0, 10).map((task) =>
      recommendation(task, context, false)
    ),
    reviewTasks: reviewTasks.slice(0, 10).map((task) =>
      recommendation(task, context, false)
    ),
    suggestedNextTask: suggestedTask
      ? recommendation(suggestedTask, context, false)
      : null,
    estimatedWorkloadHours: Math.round(openTasks.length * 1.5 * 10) / 10,
  };
}
