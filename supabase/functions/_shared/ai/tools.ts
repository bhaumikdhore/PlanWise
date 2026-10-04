import type { AgentContext, ProposedToolAction, TaskStatus } from './types.ts';

export const toolNames = [
  'get_user_tasks',
  'get_project_context',
  'get_team_members',
  'get_task_activity',
  'create_task_draft',
  'update_task_status',
  'assign_task',
  'create_notification'
] as const;

export type ToolName = typeof toolNames[number];

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
  execution: 'read_only' | 'draft_only' | 'requires_user_approval';
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const taskStatuses = new Set<TaskStatus>(['todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled']);
const projectIds = (context: AgentContext) => new Set(context.projects.map((project) => project.id));
const taskIds = (context: AgentContext) => new Set(context.assignedTasks.map((task) => task.id));
const visibleMemberIds = (context: AgentContext, projectId: string) => new Set(
  context.projectMembership.filter((membership) => membership.projectId === projectId).map((membership) => membership.userId)
);

export const aiTools: ToolDefinition[] = [
  { name: 'get_user_tasks', description: 'Read tasks assigned to the authenticated user.', parameters: { type: 'object', properties: {}, additionalProperties: false }, execution: 'read_only' },
  { name: 'get_project_context', description: 'Read a project visible to the authenticated user.', parameters: { type: 'object', properties: { project_id: { type: 'string', format: 'uuid' } }, required: ['project_id'], additionalProperties: false }, execution: 'read_only' },
  { name: 'get_team_members', description: 'Read member IDs and roles for a project visible to the authenticated user.', parameters: { type: 'object', properties: { project_id: { type: 'string', format: 'uuid' } }, required: ['project_id'], additionalProperties: false }, execution: 'read_only' },
  { name: 'get_task_activity', description: 'Read activity for a task assigned to the authenticated user.', parameters: { type: 'object', properties: { task_id: { type: 'string', format: 'uuid' } }, required: ['task_id'], additionalProperties: false }, execution: 'read_only' },
  { name: 'create_task_draft', description: 'Prepare a task draft for review; never create a database task.', parameters: { type: 'object', properties: { project_id: { type: ['string', 'null'], format: 'uuid' }, title: { type: 'string', minLength: 1, maxLength: 200 }, description: { type: 'string', maxLength: 2000 }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, due_at: { type: ['string', 'null'], format: 'date-time' } }, required: ['title'], additionalProperties: false }, execution: 'draft_only' },
  { name: 'update_task_status', description: 'Propose a status change for a task; an application permission check and user approval are required.', parameters: { type: 'object', properties: { task_id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: [...taskStatuses] } }, required: ['task_id', 'status'], additionalProperties: false }, execution: 'requires_user_approval' },
  { name: 'assign_task', description: 'Propose assigning a visible task to an existing project member; permissions and user approval are required.', parameters: { type: 'object', properties: { task_id: { type: 'string', format: 'uuid' }, user_id: { type: 'string', format: 'uuid' } }, required: ['task_id', 'user_id'], additionalProperties: false }, execution: 'requires_user_approval' },
  { name: 'create_notification', description: 'Prepare a notification for the authenticated user only; never insert it directly.', parameters: { type: 'object', properties: { user_id: { type: 'string', format: 'uuid' }, title: { type: 'string', minLength: 1, maxLength: 200 }, body: { type: 'string', maxLength: 1000 } }, required: ['user_id', 'title', 'body'], additionalProperties: false }, execution: 'requires_user_approval' }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(args: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(args).every((key) => allowed.includes(key));
}

export function validateToolProposal(value: unknown, context: AgentContext): ProposedToolAction {
  if (!isRecord(value) || typeof value.tool !== 'string' || !toolNames.includes(value.tool as ToolName)
    || !isRecord(value.arguments) || value.requiresApproval !== true) {
    throw new Error('AI returned an invalid tool proposal.');
  }

  const tool = value.tool as ToolName;
  const args = value.arguments;
  const projectIdSet = projectIds(context);
  const taskIdSet = taskIds(context);
  const uuid = (candidate: unknown): candidate is string => typeof candidate === 'string' && uuidPattern.test(candidate);

  if (tool === 'get_user_tasks') {
    if (Object.keys(args).length !== 0) throw new Error('AI returned an invalid tool proposal.');
  } else if (tool === 'get_project_context' || tool === 'get_team_members') {
    if (!hasOnlyKeys(args, ['project_id']) || !uuid(args.project_id) || !projectIdSet.has(args.project_id)) throw new Error('AI proposed an inaccessible project.');
  } else if (tool === 'get_task_activity' || tool === 'update_task_status' || tool === 'assign_task') {
    const allowedKeys = tool === 'get_task_activity' ? ['task_id'] : tool === 'update_task_status' ? ['task_id', 'status'] : ['task_id', 'user_id'];
    if (!hasOnlyKeys(args, allowedKeys) || !uuid(args.task_id) || !taskIdSet.has(args.task_id)) throw new Error('AI proposed an inaccessible task.');
    if (tool === 'update_task_status' && (typeof args.status !== 'string' || !taskStatuses.has(args.status as TaskStatus))) {
      throw new Error('AI proposed an invalid task status.');
    }
    if (tool === 'assign_task') {
      const task = context.assignedTasks.find((item) => item.id === args.task_id);
      const memberIds = task?.projectId ? visibleMemberIds(context, task.projectId) : new Set<string>();
      if (!uuid(args.user_id) || !memberIds.has(args.user_id)) throw new Error('AI proposed an invalid assignee.');
    }
  } else if (tool === 'create_task_draft') {
    if (!hasOnlyKeys(args, ['project_id', 'title', 'description', 'priority', 'due_at'])) throw new Error('AI proposed an invalid task draft.');
    if (args.project_id !== undefined && args.project_id !== null && (!uuid(args.project_id) || !projectIdSet.has(args.project_id))) {
      throw new Error('AI proposed an inaccessible project.');
    }
    if (typeof args.title !== 'string' || !args.title.trim() || args.title.length > 200) throw new Error('AI proposed an invalid task draft.');
    if (args.description !== undefined && (typeof args.description !== 'string' || args.description.length > 2000)) throw new Error('AI proposed an invalid task draft.');
    if (args.priority !== undefined && !['low', 'medium', 'high'].includes(String(args.priority))) throw new Error('AI proposed an invalid task priority.');
    if (args.due_at !== undefined && args.due_at !== null
      && (typeof args.due_at !== 'string' || Number.isNaN(Date.parse(args.due_at)))) throw new Error('AI proposed an invalid task deadline.');
  } else if (tool === 'create_notification') {
    if (!hasOnlyKeys(args, ['user_id', 'title', 'body']) || args.user_id !== context.user.id
      || typeof args.title !== 'string' || !args.title.trim() || args.title.length > 200
      || typeof args.body !== 'string' || args.body.length > 1000) {
      throw new Error('AI proposed an invalid notification.');
    }
  }

  return { tool, arguments: args, requiresApproval: true };
}
