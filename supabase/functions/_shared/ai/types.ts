export const agentNames = [
  "personal_assistant",
  "task_planner",
  "task_coach",
  "project_intelligence",
  "review_agent",
  "project_coordinator",
] as const;

export type AgentName = typeof agentNames[number];
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "completed"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface AgentRequest {
  agent?: AgentName;
  message: string;
  conversationId?: string;
  taskId?: string;
  projectId?: string | null;
  action?: "message" | "daily_plan";
}

export interface TaskRecommendation {
  taskId: string | null;
  title: string;
  reason: string;
  priority: TaskPriority | null;
  dueAt: string | null;
}

export interface TaskPlan {
  title: string;
  steps: string[];
  rationale: string;
}

export interface TaskPlanSuggestion {
  title: string;
  summary: string;
  priority: TaskPriority;
  estimatedHours: number;
  subtasks: Array<{
    title: string;
    description: string;
    estimatedHours: number;
    priority: TaskPriority;
    dependencies: number[];
  }>;
  risks: string[];
  recommendedOrder: number[];
}

export interface DailyPlan {
  priorities: TaskRecommendation[];
  overdueTasks: TaskRecommendation[];
  upcomingDeadlines: TaskRecommendation[];
  reviewTasks: TaskRecommendation[];
  suggestedNextTask: TaskRecommendation | null;
  estimatedWorkloadHours: number;
}

export interface ProjectInsight {
  projectId: string | null;
  title: string;
  detail: string;
  severity: "info" | "warning" | "high";
}

export interface ReviewReport {
  status: "ready" | "needs_attention" | "blocked";
  summary: string;
  findings: string[];
}

export interface ProposedToolAction {
  tool: string;
  arguments: Record<string, unknown>;
  requiresApproval: true;
}

export interface AgentResponse {
  agent: AgentName;
  message: string;
  recommendations: TaskRecommendation[];
  plan: TaskPlan | null;
  taskPlan: TaskPlanSuggestion | null;
  insights: ProjectInsight[];
  review: ReviewReport | null;
  proposedActions: ProposedToolAction[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ContextTask {
  id: string;
  projectId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  createdAt: string;
}

export interface AgentContext {
  user: {
    id: string;
    profile: {
      fullName: string;
      timezone: string;
      jobTitle: string;
      organization: string;
      department: string;
      skills: string[];
    };
  };
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    startDate: string | null;
    dueDate: string | null;
    workspaceId: string | null;
    ownerId: string;
  }>;
  projectMembership: Array<{
    projectId: string;
    userId: string;
    role: string;
  }>;
  assignedTasks: ContextTask[];
  taskDependencies: Array<{
    taskId: string;
    dependsOnTaskId: string;
    dependsOnTitle: string;
    dependsOnStatus: TaskStatus;
  }>;
  currentTask: ContextTask | null;
  taskActivity: Array<{
    id: string;
    projectId: string | null;
    entityId: string | null;
    actorId: string | null;
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
  }>;
  meetings: Array<{
    id: string;
    projectId: string | null;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    status: string;
  }>;
  calendarEvents: Array<{
    id: string;
    projectId: string | null;
    meetingId: string | null;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    location: string | null;
  }>;
  conversationHistory: ConversationTurn[];
  currentTime: string;
}
