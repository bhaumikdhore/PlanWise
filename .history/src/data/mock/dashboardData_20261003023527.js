export const sidebarItems = [
  { label: 'Dashboard', icon: '▣', active: true },
  { label: 'Projects', icon: '◫' },
  { label: 'Tasks', icon: '✓' },
  { label: 'Calendar', icon: '◫' },
  { label: 'Meetings', icon: '◌' },
  { label: 'Team', icon: '◎' },
  { label: 'Analytics', icon: '◔' },
  { label: 'Files', icon: '▤' },
  { label: 'AI Assistant', icon: '✦' }
];

export const metricCards = [
  {
    label: 'Tasks Today',
    value: '8',
    trend: '↑ 3%',
    tone: 'blue',
    description: '3 due before noon',
    progress: 64
  },
  {
    label: 'Completed Tasks',
    value: '48',
    trend: '↑ 12%',
    tone: 'green',
    description: 'This week',
    progress: 80
  },
  {
    label: 'Pending Tasks',
    value: '12',
    trend: '↓ 8%',
    tone: 'purple',
    description: 'Across your plans',
    progress: 42
  },
  {
    label: 'Active Goals',
    value: '4',
    trend: '2 on track',
    tone: 'amber',
    description: 'Keep your momentum',
    progress: 68
  }
];

export const analyticsData = [
  { label: 'Jan', value: 48 },
  { label: 'Feb', value: 52 },
  { label: 'Mar', value: 58 },
  { label: 'Apr', value: 62 },
  { label: 'May', value: 74 },
  { label: 'Jun', value: 66 },
  { label: 'Jul', value: 74 },
  { label: 'Aug', value: 72 }
];

export const taskItems = [
  { id: 1, title: 'Finalize project proposal', project: 'Product Launch', priority: 'High', dueTime: '10:00 AM', dueDate: '2026-09-26', completedOn: null, done: false },
  { id: 2, title: 'UI/UX Design Review', project: 'Design Sprint', priority: 'Medium', dueTime: '12:30 PM', dueDate: '2026-09-26', completedOn: 'Wed', done: true },
  { id: 3, title: 'Client Meeting Preparation', project: 'Client Onboarding', priority: 'Low', dueTime: '02:00 PM', dueDate: '2026-09-29', completedOn: null, done: false },
  { id: 4, title: 'Update documentation', project: 'Operations', priority: 'Medium', dueTime: '04:30 PM', dueDate: '2026-10-02', completedOn: null, done: false }
];

export const calendarDays = [
  { day: 'Sun', date: 30, muted: true },
  { day: 'Mon', date: 31, muted: true },
  { day: 'Tue', date: 1, muted: false },
  { day: 'Wed', date: 2, muted: false },
  { day: 'Thu', date: 3, muted: false },
  { day: 'Fri', date: 4, muted: false },
  { day: 'Sat', date: 5, muted: false },
  { day: 'Sun', date: 6, muted: false },
  { day: 'Mon', date: 7, muted: false },
  { day: 'Tue', date: 8, muted: false },
  { day: 'Wed', date: 9, muted: false },
  { day: 'Thu', date: 10, muted: false },
  { day: 'Fri', date: 11, muted: false },
  { day: 'Sat', date: 12, muted: false },
  { day: 'Sun', date: 13, muted: false },
  { day: 'Mon', date: 14, muted: false },
  { day: 'Tue', date: 15, muted: false },
  { day: 'Wed', date: 16, muted: false },
  { day: 'Thu', date: 17, muted: false },
  { day: 'Fri', date: 18, muted: false },
  { day: 'Sat', date: 19, muted: false },
  { day: 'Sun', date: 20, muted: false },
  { day: 'Mon', date: 21, muted: false },
  { day: 'Tue', date: 22, muted: false },
  { day: 'Wed', date: 23, muted: false },
  { day: 'Thu', date: 24, muted: false },
  { day: 'Fri', date: 25, muted: false, selected: true },
  { day: 'Sat', date: 26, muted: false },
  { day: 'Sun', date: 27, muted: false },
  { day: 'Mon', date: 28, muted: false },
  { day: 'Tue', date: 29, muted: false },
  { day: 'Wed', date: 30, muted: false },
  { day: 'Thu', date: 31, muted: false }
];

export const scheduleItems = [
  { time: '10:00 AM – 10:30 AM', title: 'Team Sync', tone: 'blue' },
  { time: '11:00 AM – 12:00 PM', title: 'Design Review', tone: 'purple' },
  { time: '02:00 PM – 03:00 PM', title: 'Client Meeting', tone: 'green' },
  { time: '04:00 PM – 04:30 PM', title: 'Project Planning', tone: 'amber' }
];

export const projectList = [
  { name: 'Product Launch', tasksLeft: 12, completion: 75, color: 'blue' },
  { name: 'Design Sprint', tasksLeft: 8, completion: 50, color: 'purple' },
  { name: 'Operations Review', tasksLeft: 4, completion: 25, color: 'green' },
  { name: 'Marketing Campaign', tasksLeft: 6, completion: 60, color: 'amber' }
];

export const teamMembers = [
  { name: 'Ava', initials: 'A' },
  { name: 'Lia', initials: 'L' },
  { name: 'Noah', initials: 'N' },
  { name: 'Max', initials: 'M' },
  { name: 'Emma', initials: 'E' },
  { name: 'Tom', initials: 'T' }
];

export const meetingItems = [
  { title: 'Team Sync', time: '10:00 AM – 10:30 AM', status: 'In 30 min', color: 'blue' },
  { title: 'Design Review', time: '02:00 PM – 03:00 PM', status: 'Today', color: 'purple' }
];

export const quickActions = [
  { label: 'Add Task', icon: '✓' },
  { label: 'Add Event', icon: '◫' },
  { label: 'Create Goal', icon: '◎' }
];

export const insights = [];

export const activityItems = [];

export const userProfile = {
  name: 'Bhaumik Dhore',
  role: 'Project Manager',
  initials: 'BD'
};
