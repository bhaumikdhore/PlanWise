import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { buildAgentContext } from "../_shared/ai/context.ts";
import { AiConfigurationError, AiProviderError } from "../_shared/ai/config.ts";
import { buildDailyPlan } from "../_shared/ai/dailyPlan.ts";
import { orchestrateAgent } from "../_shared/ai/orchestrator.ts";
import { agentNames } from "../_shared/ai/types.ts";
import type {
  AgentName,
  AgentRequest,
  ConversationTurn,
} from "../_shared/ai/types.ts";

const allowedHeaders =
  "authorization, apikey, content-type, x-client-info, x-supabase-api-version";

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function getAuthenticatedClient(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) throw new ApiError(401, "Sign in to use Planwise AI.");
  if (!supabaseUrl || !anonKey) {
    throw new ApiError(503, "AI service is not configured.");
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { supabase, token };
}

async function handleRequest(request: Request) {
  const { supabase, token } = getAuthenticatedClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser(
    token,
  );
  if (authError || !authData.user) {
    throw new ApiError(401, "Your Planwise session is invalid or expired.");
  }
  let input: unknown;
  try {
    const bodyText = await request.text();
    if (bodyText.length > 16_384) {
      throw new ApiError(413, "Request body is too large.");
    }
    input = JSON.parse(bodyText);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Request body must be valid JSON.");
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "Request body must be a JSON object.");
  }

  const body = input as Record<string, unknown>;
  const allowedFields = new Set([
    "message",
    "agent",
    "conversationId",
    "taskId",
    "projectId",
    "action",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    throw new ApiError(400, "The request contains unsupported fields.");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw new ApiError(400, "Enter a message before sending.");
  if (message.length > 4000) {
    throw new ApiError(413, "Messages must be 4,000 characters or fewer.");
  }

  const agent = body.agent === undefined ? "personal_assistant" : body.agent;
  if (
    typeof agent !== "string" || !agentNames.includes(agent as AgentName) ||
    !["personal_assistant", "task_planner"].includes(agent)
  ) {
    throw new ApiError(400, "This AI agent is not available.");
  }
  const action = body.action === undefined ? "message" : body.action;
  if (action !== "message" && action !== "daily_plan") {
    throw new ApiError(400, "Choose a supported AI action.");
  }
  if (action === "daily_plan" && agent !== "personal_assistant") {
    throw new ApiError(400, "Daily plans use the personal assistant.");
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const conversationId =
    body.conversationId === undefined || body.conversationId === null
      ? undefined
      : body.conversationId;
  const taskId = body.taskId === undefined || body.taskId === null
    ? undefined
    : body.taskId;
  const requestedProjectId =
    body.projectId === undefined || body.projectId === null
      ? undefined
      : body.projectId;
  if (
    (conversationId !== undefined &&
      (typeof conversationId !== "string" ||
        !uuidPattern.test(conversationId))) ||
    (taskId !== undefined &&
      (typeof taskId !== "string" || !uuidPattern.test(taskId))) ||
    (requestedProjectId !== undefined &&
      (typeof requestedProjectId !== "string" ||
        !uuidPattern.test(requestedProjectId)))
  ) {
    throw new ApiError(400, "A request identifier is invalid.");
  }

  const context = await buildAgentContext(supabase, authData.user, {
    taskId: taskId as string | undefined,
  });
  let projectId = requestedProjectId as string | undefined;
  if (context.currentTask) {
    if (projectId && projectId !== context.currentTask.projectId) {
      throw new ApiError(
        400,
        "The task does not belong to the selected project.",
      );
    }
    projectId = context.projects.some((project) =>
        project.id === context.currentTask?.projectId
      )
      ? context.currentTask.projectId || undefined
      : undefined;
  }

  let conversationHistory: ConversationTurn[] = [];
  if (conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from("ai_conversations")
      .select("id,project_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError) {
      throw new ApiError(500, "Could not load this AI conversation.");
    }
    if (!conversation) {
      throw new ApiError(404, "This AI conversation is unavailable.");
    }
    if (projectId && projectId !== conversation.project_id) {
      throw new ApiError(
        400,
        "Start a new conversation to change project context.",
      );
    }
    projectId = conversation.project_id || undefined;
    const { data: messages, error: messagesError } = await supabase.from(
      "ai_messages",
    )
      .select("role,content,metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (messagesError) {
      throw new ApiError(500, "Could not load this AI conversation.");
    }
    conversationHistory = (messages || []).reverse()
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => {
        const metadata = item.metadata && typeof item.metadata === "object"
          ? item.metadata as Record<string, unknown>
          : {};
        const taskPlan = item.role === "assistant" && metadata.taskPlan &&
            typeof metadata.taskPlan === "object"
          ? metadata.taskPlan as Record<string, unknown>
          : null;
        const contextTurn: Record<string, unknown> = {
          message: String(item.content),
        };
        if (taskPlan) {
          contextTurn.taskPlan = {
            title: taskPlan.title,
            subtasks: Array.isArray(taskPlan.subtasks)
              ? taskPlan.subtasks.slice(0, 20).map((subtask) => {
                const row = subtask && typeof subtask === "object"
                  ? subtask as Record<string, unknown>
                  : {};
                return { title: row.title, dependencies: row.dependencies };
              })
              : [],
            recommendedOrder: taskPlan.recommendedOrder,
          };
        }
        const dailyPlan = item.role === "assistant" && metadata.dailyPlan &&
            typeof metadata.dailyPlan === "object"
          ? metadata.dailyPlan as Record<string, unknown>
          : null;
        if (dailyPlan) contextTurn.dailyPlan = dailyPlan;
        const content = taskPlan || dailyPlan
          ? JSON.stringify(contextTurn)
          : String(item.content);
        return {
          role: item.role as "user" | "assistant",
          content: content.slice(0, 4000),
        };
      });
  }

  if (
    projectId && !context.projects.some((project) => project.id === projectId)
  ) {
    throw new ApiError(403, "You do not have access to this project.");
  }
  if (agent === "task_planner" && projectId) {
    const project = context.projects.find((item) => item.id === projectId);
    const projectRole = context.projectMembership.find((member) =>
      member.projectId === projectId && member.userId === authData.user.id
    )?.role;
    const workspaceRole = context.workspaces.find((workspace) =>
      workspace.id === project?.workspaceId
    )?.role;
    const canContribute = project?.ownerId === authData.user.id ||
      (projectRole && projectRole !== "viewer") ||
      (workspaceRole && workspaceRole !== "viewer");
    if (!canContribute) {
      throw new ApiError(403, "You cannot create tasks in this project.");
    }
  }
  if (
    agent === "task_planner" && context.currentTask?.projectId && !projectId
  ) {
    throw new ApiError(403, "You cannot create tasks in this project.");
  }

  context.conversationHistory = conversationHistory;
  const requestPayload: AgentRequest = {
    agent: agent as AgentName,
    message,
    conversationId: conversationId as string | undefined,
    taskId: taskId as string | undefined,
    projectId: projectId || null,
    action,
  };
  const response = await orchestrateAgent(requestPayload, context);
  const dailyPlan = action === "daily_plan"
    ? buildDailyPlan(context)
    : undefined;
  const { data: savedConversationId, error: saveError } = await supabase.rpc(
    "append_ai_exchange",
    {
      p_conversation_id: conversationId || null,
      p_project_id: projectId || null,
      p_user_content: message,
      p_assistant_content: response.message,
      p_metadata: { ...response, ...(dailyPlan ? { dailyPlan } : {}) },
    },
  );
  if (saveError || !savedConversationId) {
    console.error("[ai-assistant] Conversation persistence failed", {
      errorType: saveError?.code || "UnknownError",
    });
    throw new ApiError(
      503,
      "The AI response could not be saved. Please try again.",
    );
  }
  return {
    ...response,
    conversationId: savedConversationId,
    ...(dailyPlan ? { dailyPlan } : {}),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse({});
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    return jsonResponse(await handleRequest(request));
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    if (error instanceof AiConfigurationError) {
      return jsonResponse({ error: error.message }, 503);
    }
    if (error instanceof AiProviderError) {
      return jsonResponse({
        error: "The AI provider could not answer right now. Please try again.",
      }, 502);
    }
    console.error("[ai-assistant] Request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse({
      error: "AI request failed unexpectedly. Please try again.",
    }, 500);
  }
});
