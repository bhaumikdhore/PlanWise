import { taskItems } from '../../data/mock/dashboardData.js';

const STORAGE_KEY = 'planwise-project-data-v1';

const seedData = {
  projects: [
    { id: 'product-launch', name: 'Product Launch', description: 'Bring the next generation of our product to market with a thoughtful, polished launch.', status: 'Active', progress: 75, startDate: '2026-08-18', deadline: '2026-10-16', owner: 'Bhaumik Dhore', members: ['Ava', 'Noah', 'Lia'], color: 'blue', archived: false },
    { id: 'design-sprint', name: 'Design Sprint', description: 'Explore, prototype, and validate a more intuitive planning experience.', status: 'Planning', progress: 50, startDate: '2026-09-14', deadline: '2026-10-08', owner: 'Ava Patel', members: ['Lia', 'Max'], color: 'purple', archived: false },
    { id: 'client-onboarding', name: 'Client Onboarding', description: 'Make every new customer feel confident, supported, and ready to get started.', status: 'Active', progress: 50, startDate: '2026-08-25', deadline: '2026-11-02', owner: 'Noah Kim', members: ['Ava', 'Emma', 'Tom'], color: 'green', archived: false },
    { id: 'operations-review', name: 'Operations Review', description: 'Streamline team workflows and document the processes that help us do our best work.', status: 'On Hold', progress: 25, startDate: '2026-08-04', deadline: '2026-10-30', owner: 'Lia Chen', members: ['Max', 'Tom'], color: 'amber', archived: false },
    { id: 'brand-refresh', name: 'Brand Refresh', description: 'A refreshed identity that brings our product story to life across every touchpoint.', status: 'Completed', progress: 100, startDate: '2026-06-01', deadline: '2026-09-18', owner: 'Max Rivera', members: ['Ava', 'Emma'], color: 'purple', archived: false }
  ],
  tasks: taskItems.map((task, index) => ({
    ...task,
    id: `seed-task-${task.id}`,
    description: [
      'Prepare the final roadmap and align the delivery team.',
      'Review the latest screens with the design team.',
      'Gather notes and questions before the client call.',
      'Keep the internal playbook current for the next sprint.'
    ][index],
    category: index === 1 ? 'Work' : 'Planning',
    projectId: ['product-launch', 'design-sprint', 'client-onboarding', 'operations-review'][index]
  })).concat([
    { id: 'launch-qa', title: 'Complete launch QA', description: 'Run through the pre-release checklist with the team.', priority: 'High', dueDate: '2026-10-09', dueTime: '10:00', category: 'Work', done: true, projectId: 'product-launch' },
    { id: 'launch-copy', title: 'Approve launch messaging', description: 'Sign off on the launch announcement and product copy.', priority: 'Medium', dueDate: '2026-10-12', dueTime: '14:00', category: 'Planning', done: true, projectId: 'product-launch' },
    { id: 'sprint-prototype', title: 'Share prototype for feedback', description: 'Gather feedback on the interactive prototype.', priority: 'Medium', dueDate: '2026-10-01', dueTime: '11:00', category: 'Work', done: true, projectId: 'design-sprint' },
    { id: 'onboarding-guide', title: 'Draft getting-started guide', description: 'Create a first draft of the customer welcome guide.', priority: 'Medium', dueDate: '2026-10-05', dueTime: '13:00', category: 'Planning', done: true, projectId: 'client-onboarding' },
    { id: 'operations-audit', title: 'Map current workflows', description: 'Capture the current team handoffs and bottlenecks.', priority: 'Low', dueDate: '2026-10-20', dueTime: '09:30', category: 'Planning', done: true, projectId: 'operations-review' },
    { id: 'operations-notes', title: 'Share process review notes', description: 'Collect findings from the operations review.', priority: 'Low', dueDate: '2026-10-27', dueTime: '15:00', category: 'Work', done: false, projectId: 'operations-review' },
    { id: 'brand-guidelines', title: 'Publish brand guidelines', description: 'Share the final brand kit with the team.', priority: 'Medium', dueDate: '2026-09-16', dueTime: '10:00', category: 'Work', done: true, projectId: 'brand-refresh' },
    { id: 'brand-assets', title: 'Export campaign assets', description: 'Prepare the final campaign-ready exports.', priority: 'Low', dueDate: '2026-09-17', dueTime: '12:00', category: 'Work', done: true, projectId: 'brand-refresh' }
  ]),
  meetings: [
    { id: 'meeting-launch-sync', projectId: 'product-launch', title: 'Launch check-in', date: '2026-09-28', time: '10:00', duration: 30, attendees: ['Ava', 'Noah'] },
    { id: 'meeting-launch-review', projectId: 'product-launch', title: 'Release readiness review', date: '2026-10-05', time: '14:00', duration: 45, attendees: ['Lia', 'Noah'] },
    { id: 'meeting-design-review', projectId: 'design-sprint', title: 'Prototype feedback', date: '2026-09-30', time: '11:30', duration: 45, attendees: ['Lia', 'Max'] },
    { id: 'meeting-onboarding', projectId: 'client-onboarding', title: 'Customer journey workshop', date: '2026-10-02', time: '13:00', duration: 60, attendees: ['Ava', 'Emma'] },
    { id: 'meeting-operations', projectId: 'operations-review', title: 'Workflow review', date: '2026-10-21', time: '09:30', duration: 45, attendees: ['Max', 'Tom'] }
  ],
  files: [
    { id: 'file-launch-brief', projectId: 'product-launch', name: 'Product launch brief.pdf', size: '2.4 MB', addedAt: '2026-09-20', kind: 'PDF' },
    { id: 'file-launch-roadmap', projectId: 'product-launch', name: 'Release roadmap.fig', size: '840 KB', addedAt: '2026-09-18', kind: 'FIG' },
    { id: 'file-design-research', projectId: 'design-sprint', name: 'Research findings.docx', size: '1.1 MB', addedAt: '2026-09-16', kind: 'DOC' },
    { id: 'file-onboarding-flow', projectId: 'client-onboarding', name: 'Onboarding flow.pdf', size: '1.8 MB', addedAt: '2026-09-12', kind: 'PDF' }
  ],
  goals: [
    { id: 'goal-launch', projectId: 'product-launch', title: 'Make launch day a success', targetDate: '2026-10-16', progress: 68, status: 'On track' },
    { id: 'goal-design', projectId: 'design-sprint', title: 'Validate a clearer planning flow', targetDate: '2026-10-08', progress: 35, status: 'On track' },
    { id: 'goal-onboarding', projectId: 'client-onboarding', title: 'Help new customers reach first value', targetDate: '2026-11-02', progress: 60, status: 'On track' }
  ]
};

function readData() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    writeData(seedData);
    return seedData;
  }
  return JSON.parse(stored);
}

function writeData(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function updateData(update) {
  const data = readData();
  const next = update(data);
  writeData(next);
  return next;
}

export function getProjects() {
  return readData().projects;
}

export function getProject(projectId) {
  return getProjects().find((project) => project.id === projectId) || null;
}

export function saveProject(project) {
  return updateData((data) => {
    const exists = data.projects.some((item) => item.id === project.id);
    const projects = exists
      ? data.projects.map((item) => item.id === project.id ? { ...item, ...project } : item)
      : [{ ...project, id: `project-${Date.now()}`, archived: false }, ...data.projects];
    return { ...data, projects };
  });
}

export function deleteProject(projectId) {
  return updateData((data) => ({
    ...data,
    projects: data.projects.filter((project) => project.id !== projectId),
    tasks: data.tasks.map((task) => task.projectId === projectId ? { ...task, projectId: '' } : task),
    meetings: data.meetings.map((meeting) => meeting.projectId === projectId ? { ...meeting, projectId: '' } : meeting),
    files: data.files.map((file) => file.projectId === projectId ? { ...file, projectId: '' } : file),
    goals: data.goals.map((goal) => goal.projectId === projectId ? { ...goal, projectId: '' } : goal)
  }));
}

export function getTasks(projectId) {
  const tasks = readData().tasks;
  return projectId ? tasks.filter((task) => task.projectId === projectId) : tasks;
}

export function saveTasks(tasks) {
  return updateData((data) => {
    const projects = data.projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      return projectTasks.length
        ? { ...project, progress: Math.round(projectTasks.filter((task) => task.done).length / projectTasks.length * 100) }
        : project;
    });
    return { ...data, tasks, projects };
  });
}

export function getMeetings(projectId) {
  const meetings = readData().meetings;
  return projectId ? meetings.filter((meeting) => meeting.projectId === projectId) : meetings;
}

export function saveMeeting(meeting) {
  const meetingId = meeting.id || `meeting-${crypto.randomUUID()}`;
  const data = updateData((data) => {
    const exists = data.meetings.some((item) => item.id === meetingId);
    const saved = exists
      ? { ...data.meetings.find((item) => item.id === meetingId), ...meeting }
      : { ...meeting, id: meetingId };
    return {
      ...data,
      meetings: exists
        ? data.meetings.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...data.meetings]
    };
  });
  return data.meetings.find((item) => item.id === meetingId);
}

export function deleteMeeting(meetingId) {
  return updateData((data) => ({
    ...data,
    meetings: data.meetings.filter((meeting) => meeting.id !== meetingId)
  }));
}

export function getFiles(projectId) {
  const files = readData().files;
  return projectId ? files.filter((file) => file.projectId === projectId) : files;
}

export function saveFile(file) {
  return updateData((data) => ({ ...data, files: [{ ...file, id: `file-${Date.now()}` }, ...data.files] }));
}

export function getGoals(projectId) {
  const goals = readData().goals;
  return projectId ? goals.filter((goal) => goal.projectId === projectId) : goals;
}

export function saveGoal(goal) {
  return updateData((data) => {
    const exists = data.goals.some((item) => item.id === goal.id);
    const goals = exists
      ? data.goals.map((item) => item.id === goal.id ? { ...item, ...goal } : item)
      : [{ ...goal, id: `goal-${Date.now()}` }, ...data.goals];
    return { ...data, goals };
  });
}
