import { MAX_CONTEXT_ITEMS } from "./config.ts";
import type {
  AgentContext,
  ConversationTurn,
  TaskPriority,
  TaskStatus,
} from "./types.ts";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.117.2";

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function dataOrThrow<T>(result: QueryResult<T>): T {
  if (result.error || result.data === null) {
    throw new Error("Could not load authorized Planwise context.");
  }
  return result.data;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function buildAgentContext(
  supabase: SupabaseClient,
  user: User,
  options: { taskId?: string; conversationHistory?: ConversationTurn[] } = {},
): Promise<AgentContext> {
  const [
    profileResult,
    workspaceMembershipResult,
    projectResult,
    assignmentResult,
    notificationResult,
    meetingParticipationResult,
    calendarResult,
    currentTaskResult,
  ] = await Promise.all([
    supabase.rpc("get_my_profile_settings"),
    supabase.from("workspace_members").select("workspace_id,role").eq(
      "user_id",
      user.id,
    ).limit(MAX_CONTEXT_ITEMS),
    supabase.from("projects").select(
      "id,name,description,status,start_date,due_date,workspace_id,owner_id",
    ).order("created_at", { ascending: false }).limit(MAX_CONTEXT_ITEMS),
    supabase.from("task_assignees").select("task_id").eq("user_id", user.id)
      .limit(MAX_CONTEXT_ITEMS),
    supabase.from("notifications").select(
      "id,type,title,body,read_at,created_at",
    ).eq("user_id", user.id).order("created_at", { ascending: false }).limit(
      20,
    ),
    supabase.from("meeting_participants").select("meeting_id").eq(
      "user_id",
      user.id,
    ).limit(MAX_CONTEXT_ITEMS),
    supabase.from("calendar_events").select(
      "id,project_id,meeting_id,title,description,starts_at,ends_at,all_day,location",
    ).eq("user_id", user.id).order("starts_at", { ascending: true }).limit(20),
    options.taskId
      ? supabase.from("tasks").select(
        "id,project_id,title,description,status,priority,due_at,created_at",
      ).eq("id", options.taskId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResult.error || currentTaskResult.error) {
    throw new Error("Could not load authorized Planwise context.");
  }
  if (options.taskId && !currentTaskResult.data) {
    throw new Error("Task context is unavailable or you do not have access.");
  }
  const profile = profileResult.data;
  const workspaceMemberships = dataOrThrow(workspaceMembershipResult);
  const projects = dataOrThrow(projectResult);
  const assignments = dataOrThrow(assignmentResult);
  const notifications = dataOrThrow(notificationResult);
  const meetingParticipants = dataOrThrow(meetingParticipationResult);
  const calendarRows = dataOrThrow(calendarResult);

  const workspaceIds = [
    ...new Set(workspaceMemberships.map((row) => row.workspace_id as string)),
  ];
  const visibleProjectIds = projects.map((row) => row.id as string);
  const taskIds = [
    ...new Set([
      ...assignments.map((row) => row.task_id as string),
      ...(currentTaskResult.data ? [currentTaskResult.data.id as string] : []),
    ]),
  ];
  const meetingIds = [
    ...new Set(meetingParticipants.map((row) => row.meeting_id as string)),
  ];

  const [workspaceResult, projectMembershipResult, taskResult, meetingResult] =
    await Promise.all([
      workspaceIds.length
        ? supabase.from("workspaces").select("id,name").in("id", workspaceIds)
        : Promise.resolve({ data: [], error: null }),
      visibleProjectIds.length
        ? supabase.from("project_members").select("project_id,user_id,role").in(
          "project_id",
          visibleProjectIds,
        ).limit(MAX_CONTEXT_ITEMS)
        : Promise.resolve({ data: [], error: null }),
      taskIds.length
        ? supabase.from("tasks").select(
          "id,project_id,title,description,status,priority,due_at,created_at",
        ).in("id", taskIds).order("due_at", { ascending: true }).limit(
          MAX_CONTEXT_ITEMS,
        )
        : Promise.resolve({ data: [], error: null }),
      meetingIds.length
        ? supabase.from("meetings").select(
          "id,project_id,title,description,starts_at,ends_at,location,status",
        ).in("id", meetingIds).order("starts_at", { ascending: true }).limit(
          MAX_CONTEXT_ITEMS,
        )
        : Promise.resolve({ data: [], error: null }),
    ]);

  const workspaceRows = dataOrThrow(workspaceResult);
  const projectMemberships = dataOrThrow(projectMembershipResult);
  const taskRows = dataOrThrow(taskResult);
  const meetingRows = dataOrThrow(meetingResult);
  const authorizedProjectIds = projects.map((row) => row.id as string);
  const authorizedTaskIds = taskRows.map((row) => row.id as string);
  const [projectActivityResult, taskActivityResult, dependencyResult] =
    await Promise.all([
      authorizedProjectIds.length
        ? supabase.from("activity_logs").select(
          "id,project_id,entity_id,actor_id,action,metadata,created_at",
        ).eq("entity_type", "task").in("project_id", authorizedProjectIds)
          .order("created_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [], error: null }),
      authorizedTaskIds.length
        ? supabase.from("activity_logs").select(
          "id,project_id,entity_id,actor_id,action,metadata,created_at",
        ).eq("entity_type", "task").in("entity_id", authorizedTaskIds).order(
          "created_at",
          { ascending: false },
        ).limit(30)
        : Promise.resolve({ data: [], error: null }),
      authorizedTaskIds.length
        ? supabase.from("task_dependencies").select(
          "task_id,depends_on_task_id",
        ).in("task_id", authorizedTaskIds).limit(MAX_CONTEXT_ITEMS)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const activity = [
    ...dataOrThrow(projectActivityResult),
    ...dataOrThrow(taskActivityResult),
  ];
  const dependencies = dataOrThrow(dependencyResult);
  const dependencyTaskIds = [
    ...new Set(dependencies.map((row) => row.depends_on_task_id as string)),
  ];
  const dependencyTaskResult = dependencyTaskIds.length
    ? await supabase.from("tasks").select("id,title,status").in(
      "id",
      dependencyTaskIds,
    )
    : { data: [], error: null };
  const dependencyTasks = dataOrThrow(dependencyTaskResult);
  const visibleDependencies = new Map(
    dependencyTasks.map((
      row,
    ) => [row.id, { title: row.title, status: row.status }]),
  );
  const activityById = new Map(activity.map((row) => [row.id, row]));
  const fullName = text(profile?.full_name) ||
    text(user.user_metadata?.full_name) || text(user.user_metadata?.name);
  const roleByWorkspace = new Map(
    workspaceMemberships.map((row) => [row.workspace_id, row.role]),
  );

  return {
    user: {
      id: user.id,
      profile: {
        fullName,
        timezone: text(profile?.timezone) || "UTC",
        jobTitle: text(profile?.job_title),
        organization: text(profile?.organization),
        department: text(profile?.department),
        skills: Array.isArray(profile?.skills)
          ? profile.skills.filter((skill: unknown): skill is string =>
            typeof skill === "string"
          ).slice(0, 30)
          : [],
      },
    },
    workspaces: workspaceRows.map((workspace) => ({
      id: text(workspace.id),
      name: text(workspace.name),
      role: text(roleByWorkspace.get(workspace.id)),
    })),
    projects: projects.map((project) => ({
      id: text(project.id),
      name: text(project.name),
      description: text(project.description),
      status: text(project.status),
      startDate: nullableText(project.start_date),
      dueDate: nullableText(project.due_date),
      workspaceId: nullableText(project.workspace_id),
      ownerId: text(project.owner_id),
    })),
    projectMembership: projectMemberships.map((membership) => ({
      projectId: text(membership.project_id),
      userId: text(membership.user_id),
      role: text(membership.role),
    })),
    assignedTasks: taskRows.map((task) => ({
      id: text(task.id),
      projectId: nullableText(task.project_id),
      title: text(task.title),
      description: text(task.description),
      status: text(task.status) as TaskStatus,
      priority: text(task.priority) as TaskPriority,
      dueAt: nullableText(task.due_at),
      createdAt: text(task.created_at),
    })),
    taskDependencies: dependencies
      .filter((dependency) =>
        authorizedTaskIds.includes(dependency.task_id as string) &&
        visibleDependencies.has(dependency.depends_on_task_id)
      )
      .map((dependency) => ({
        taskId: text(dependency.task_id),
        dependsOnTaskId: text(dependency.depends_on_task_id),
        dependsOnTitle: text(
          visibleDependencies.get(dependency.depends_on_task_id)?.title,
        ),
        dependsOnStatus: text(
          visibleDependencies.get(dependency.depends_on_task_id)?.status,
        ) as TaskStatus,
      })),
    currentTask: currentTaskResult.data
      ? {
        id: text(currentTaskResult.data.id),
        projectId: nullableText(currentTaskResult.data.project_id),
        title: text(currentTaskResult.data.title),
        description: text(currentTaskResult.data.description),
        status: text(currentTaskResult.data.status) as TaskStatus,
        priority: text(currentTaskResult.data.priority) as TaskPriority,
        dueAt: nullableText(currentTaskResult.data.due_at),
        createdAt: text(currentTaskResult.data.created_at),
      }
      : null,
    taskActivity: [...activityById.values()].slice(0, 40).map((row) => ({
      id: text(row.id),
      projectId: nullableText(row.project_id),
      entityId: nullableText(row.entity_id),
      actorId: nullableText(row.actor_id),
      action: text(row.action),
      metadata: object(row.metadata),
      createdAt: text(row.created_at),
    })),
    notifications: notifications.map((notification) => ({
      id: text(notification.id),
      type: text(notification.type),
      title: text(notification.title),
      body: text(notification.body),
      readAt: nullableText(notification.read_at),
      createdAt: text(notification.created_at),
    })),
    meetings: meetingRows.map((meeting) => ({
      id: text(meeting.id),
      projectId: nullableText(meeting.project_id),
      title: text(meeting.title),
      description: text(meeting.description),
      startsAt: text(meeting.starts_at),
      endsAt: text(meeting.ends_at),
      location: nullableText(meeting.location),
      status: text(meeting.status),
    })),
    calendarEvents: calendarRows.map((event) => ({
      id: text(event.id),
      projectId: nullableText(event.project_id),
      meetingId: nullableText(event.meeting_id),
      title: text(event.title),
      description: text(event.description),
      startsAt: text(event.starts_at),
      endsAt: text(event.ends_at),
      allDay: Boolean(event.all_day),
      location: nullableText(event.location),
    })),
    conversationHistory: (options.conversationHistory || []).slice(-12),
    currentTime: new Date().toISOString(),
  };
}
