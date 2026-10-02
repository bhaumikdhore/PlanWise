import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import DashboardLayout from '../../layouts/DashboardLayout';
import { taskItems } from '../../data/mock/dashboardData';
import { getProjectGoals } from '../../services/goals/projectGoalService';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const today = new Date().toISOString().slice(0, 10);

export default function AnalyticsPage({ onNavigate, onLogout, session }) {
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState('');

  useEffect(() => {
    let active = true;
    getProjectGoals().then((result) => {
      if (active) setGoals(result);
    }).catch((error) => {
      if (active) setGoalsError(error.message || 'Could not load project goals.');
    }).finally(() => {
      if (active) setGoalsLoading(false);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  const analytics = useMemo(() => {
    const completed = taskItems.filter((task) => task.done);
    const pending = taskItems.filter((task) => !task.done);
    const overdue = pending.filter((task) => task.dueDate && task.dueDate < today);
    const weekly = days.map((day) => ({ day, value: completed.filter((task) => task.completedOn === day).length }));
    const priorities = ['High', 'Medium', 'Low'].map((priority) => ({ priority, value: taskItems.filter((task) => task.priority === priority).length }));
    const mostProductive = weekly.reduce((best, current) => current.value > best.value ? current : best, weekly[0]);
    return { completed, pending, overdue, weekly, priorities, mostProductive, completionRate: taskItems.length ? Math.round((completed.length / taskItems.length) * 100) : 0 };
  }, []);

  const distribution = [
    { label: 'Completed', value: analytics.completed.length, tone: 'green' },
    { label: 'Pending', value: analytics.pending.length - analytics.overdue.length, tone: 'blue' },
    { label: 'Overdue', value: analytics.overdue.length, tone: 'danger' }
  ];
  const maxWeekly = Math.max(...analytics.weekly.map((item) => item.value), 1);
  const maxPriority = Math.max(...analytics.priorities.map((item) => item.value), 1);

  return (
    <DashboardLayout onNavigate={onNavigate} onLogout={onLogout} backgroundVariant="analytics">
      <section className="analytics-page">
        <header className="analytics-page-header"><div><span className="panel-kicker">Performance snapshot</span><h1>Analytics</h1><p>Understand your productivity patterns and make your next plan more intentional.</p></div><Button type="button" variant="secondary" onClick={() => onNavigate('tasks')}>View Tasks</Button></header>

        <section className="analytics-summary-grid" aria-label="Productivity summary">
          {[['Tasks Completed', analytics.completed.length, 'green'], ['Tasks Pending', analytics.pending.length, 'blue'], ['Completion Rate', `${analytics.completionRate}%`, 'purple'], ['Active Goals', goalsLoading ? '…' : goals.length, 'amber']].map(([label, value, tone]) => <article key={label} className="analytics-summary-card"><span className={`analytics-summary-icon ${tone}`}>{tone === 'green' ? '✓' : tone === 'blue' ? '◷' : tone === 'purple' ? '◔' : '◎'}</span><span>{label}</span><strong>{value}</strong></article>)}
        </section>

        <div className="analytics-layout-grid">
          <section className="analytics-card analytics-weekly"><div className="analytics-card-heading"><div><span className="panel-kicker">This week</span><h2>Weekly Productivity</h2></div><span className="analytics-card-note">Completed tasks</span></div><div className="analytics-bars" aria-label="Completed tasks by day">{analytics.weekly.map((item) => <div className="analytics-bar-column" key={item.day}><span className="analytics-bar-value">{item.value}</span><div className="analytics-bar-track"><i style={{ height: `${Math.max((item.value / maxWeekly) * 100, item.value ? 18 : 4)}%` }} /></div><small>{item.day}</small></div>)}</div></section>
          <section className="analytics-card"><div className="analytics-card-heading"><div><span className="panel-kicker">Task health</span><h2>Task Distribution</h2></div></div><div className="analytics-donut-wrap"><div className="analytics-donut" style={{ '--completed': `${analytics.completed.length / Math.max(taskItems.length, 1) * 100}%`, '--pending': `${(analytics.pending.length - analytics.overdue.length) / Math.max(taskItems.length, 1) * 100}%` }}><strong>{taskItems.length}</strong><span>Total tasks</span></div><div className="analytics-legend">{distribution.map((item) => <span key={item.label}><i className={item.tone} />{item.label}<b>{item.value}</b></span>)}</div></div></section>
        </div>

        <div className="analytics-layout-grid">
          <section className="analytics-card"><div className="analytics-card-heading"><div><span className="panel-kicker">Where attention goes</span><h2>Priority Analysis</h2></div></div><div className="analytics-priority-list">{analytics.priorities.map((item) => <div className="analytics-priority-row" key={item.priority}><span>{item.priority}</span><div><i style={{ width: `${(item.value / maxPriority) * 100}%` }} /></div><b>{item.value}</b></div>)}</div></section>
          <section className="analytics-card"><div className="analytics-card-heading"><div><span className="panel-kicker">Active goals</span><h2>Goal Progress</h2></div></div>{goalsLoading ? <div role="status">Loading goals…</div> : goalsError ? <p role="alert">{goalsError}</p> : goals.length ? <div className="analytics-goal-list">{goals.map((goal) => <div className="analytics-goal-row" key={goal.id}><div><strong>{goal.title}</strong><span>{goal.status}</span></div><b>{goal.progress}%</b><div className="analytics-progress"><i style={{ width: `${goal.progress}%` }} /></div></div>)}</div> : <div className="analytics-goal-list"><p>No project goals yet.</p></div>}</section>
        </div>

        <div className="analytics-layout-grid">
          <section className="analytics-card"><div className="analytics-card-heading"><div><span className="panel-kicker">Momentum</span><h2>Productivity Trends</h2></div><span className="analytics-trend-badge">+12% this month</span></div><div className="analytics-trend-chart" aria-label="Weekly productivity trend"><i /><i /><i /><i /><i /><i /><i /><b /></div><div className="analytics-trend-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div></section>
          <section className="analytics-card analytics-insights"><div className="analytics-card-heading"><div><span className="panel-kicker">From your data</span><h2>Key Insights</h2></div></div><p>You completed the most tasks on <strong>{analytics.mostProductive.day}</strong>.</p><p>{analytics.completionRate}% of your current tasks are complete.</p><p>{analytics.overdue.length ? `${analytics.overdue.length} task needs attention.` : 'No overdue tasks are currently recorded.'}</p></section>
        </div>
      </section>
    </DashboardLayout>
  );
}
