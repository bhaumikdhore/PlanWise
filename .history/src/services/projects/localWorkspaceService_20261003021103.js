const STORAGE_KEY = 'planwise-project-data-v1';

const initialData = {
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
  return stored ? { ...initialData, ...JSON.parse(stored) } : initialData;
}

function updateData(update) {
  const next = update(readData());
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
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