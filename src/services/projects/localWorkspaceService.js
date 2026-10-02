const STORAGE_KEY = 'planwise-project-data-v1';

const initialData = {
  files: [
    { id: 'file-launch-brief', projectId: 'product-launch', name: 'Product launch brief.pdf', size: '2.4 MB', addedAt: '2026-09-20', kind: 'PDF' },
    { id: 'file-launch-roadmap', projectId: 'product-launch', name: 'Release roadmap.fig', size: '840 KB', addedAt: '2026-09-18', kind: 'FIG' },
    { id: 'file-design-research', projectId: 'design-sprint', name: 'Research findings.docx', size: '1.1 MB', addedAt: '2026-09-16', kind: 'DOC' },
    { id: 'file-onboarding-flow', projectId: 'client-onboarding', name: 'Onboarding flow.pdf', size: '1.8 MB', addedAt: '2026-09-12', kind: 'PDF' }
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
