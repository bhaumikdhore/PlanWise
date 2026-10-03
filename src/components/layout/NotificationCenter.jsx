import { useEffect, useState } from 'react';
import { getNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '../../services/notifications/notificationService';

export default function NotificationCenter({ profileIncomplete = false, onCompleteProfile, userId, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setNotifications(await getNotifications());
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    if (!userId) return undefined;
    return subscribeToNotifications(userId, () => refresh());
  }, [userId]);
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const markRead = async (notification) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, read_at: new Date().toISOString() }
        : item));
      setSuccess('Notification marked as read.');
    } catch (saveError) {
      setError(saveError.message || 'Could not update this notification.');
    } finally {
      setSaving(false);
    }
  };

  const markAllRead = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: readAt })));
      setSuccess('All notifications marked as read.');
    } catch (saveError) {
      setError(saveError.message || 'Could not update notifications.');
    } finally {
      setSaving(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.read_at).length + (profileIncomplete ? 1 : 0);
  const openNotification = async (notification) => {
    if (!notification.read_at) await markRead(notification);
    const payload = notification.payload || {};
    if (notification.entity_type === 'task' || payload.task_id) {
      onNavigate?.(`tasks?task=${encodeURIComponent(payload.task_id || notification.entity_id)}`);
    } else if (notification.entity_type === 'project' || payload.project_id) {
      onNavigate?.(`projects/${payload.project_id || notification.entity_id}`);
    } else {
      onNavigate?.('team');
    }
    setOpen(false);
  };

  return <div className="notification-center">
    <button type="button" className="icon-button notification-toggle" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">🔔</span>{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-panel" id="notification-panel" aria-label="Notifications">
      <div className="notification-panel-heading"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div><button type="button" onClick={refresh} disabled={loading} aria-label="Refresh notifications">↻</button></div>
      {error && <div className="notification-message notification-error" role="alert">{error}<button type="button" onClick={refresh}>Retry</button></div>}
      {success && <div className="notification-message" role="status">{success}</div>}
      {loading ? <div className="notification-panel-state" role="status">Loading notifications…</div> : unreadCount || notifications.length ? <>
        <div className="notification-list">
          {profileIncomplete && <article className="notification-item profile-completion-notification">
            <div><strong>Complete your profile to get started</strong><p>Add your name, job title, and organization to finish setting up your account.</p></div>
            <button type="button" onClick={onCompleteProfile}>Complete profile</button>
          </article>}
          {notifications.map((notification) => <article className="notification-item" key={notification.id}>
          <button type="button" className={`notification-item-content${notification.read_at ? ' is-read' : ''}`} onClick={() => openNotification(notification)}>
            <strong>{notification.title}</strong><p>{notification.body || notification.type.replaceAll('_', ' ')}</p><time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
          </button>
          {!notification.read_at && <button type="button" onClick={() => markRead(notification)} disabled={saving}>Mark read</button>}
        </article>)}
        </div>
        {notifications.some((item) => !item.read_at) && <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={saving}>Mark all as read</button>}
      </> : !error && <div className="notification-panel-state"><strong>You’re all caught up</strong><span>No unread notifications.</span></div>}
    </section>}
  </div>;
}