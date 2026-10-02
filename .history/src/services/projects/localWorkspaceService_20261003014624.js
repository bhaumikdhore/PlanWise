const STORAGE_KEY = 'planwise-project-data-v1';

const initialData = {
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
  return stored ? { ...initialData, ...JSON.parse(stored) } : initialData;
}

function updateData(update) {
  const next = update(readData());
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function normalizeMeeting(meeting) {
  const startTime = meeting.startTime || meeting.time || '09:00';
  const start = new Date(`${meeting.date}T${startTime}:00`);
  const end = new Date(start.getTime() + (Number(meeting.duration) || 30) * 60000);
  const time = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return {
    ...meeting,
    startTime,
    endTime: meeting.endTime || time(end),
    participants: meeting.participants || meeting.attendees || [],
    reminder: meeting.reminder ?? 10,
    meetingType: meeting.meetingType || 'Team meeting',
    status: meeting.status || 'Upcoming',
    actionItems: meeting.actionItems || []
  };
}

export function getMeetings(projectId) {
  const meetings = readData().meetings.map(normalizeMeeting);
  return projectId ? meetings.filter((meeting) => meeting.projectId === projectId) : meetings;
}

export function saveMeeting(meeting) {
  const meetingId = meeting.id || `meeting-${crypto.randomUUID()}`;
  const saved = updateData((data) => {
    const exists = data.meetings.some((item) => item.id === meetingId);
    const nextMeeting = exists
      ? { ...data.meetings.find((item) => item.id === meetingId), ...meeting }
      : { ...meeting, id: meetingId };
    return {
      ...data,
      meetings: exists
        ? data.meetings.map((item) => item.id === meetingId ? nextMeeting : item)
        : [nextMeeting, ...data.meetings]
    };
  });
  return normalizeMeeting(saved.meetings.find((item) => item.id === meetingId));
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