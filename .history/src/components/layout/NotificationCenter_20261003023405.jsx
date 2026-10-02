import { useEffect, useState } from 'react';
import { getUnreadNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications/notificationService';

export default function NotificationCenter() {
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
      setNotifications(await getUnreadNotifications());
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const markRead = async (notification) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
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
      setNotifications([]);
      setSuccess('All notifications marked as read.');
    } catch (saveError) {
      setError(saveError.message || 'Could not update notifications.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="notification-center">
    <button type="button" className="icon-button notification-toggle" aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">🔔</span>{notifications.length > 0 && <span className="notification-count">{notifications.length > 99 ? '99+' : notifications.length}</span>}
    </button>
    {open && <section className="notification-panel" id="notification-panel" aria-label="Unread notifications">
      <div className="notification-panel-heading"><div><strong>Notifications</strong><span>{notifications.length} unread</span></div><button type="button" onClick={refresh} disabled={loading} aria-label="Refresh notifications">↻</button></div>
      {error && <div className="notification-message notification-error" role="alert">{error}<button type="button" onClick={refresh}>Retry</button></div>}
      {success && <div className="notification-message" role="status">{success}</div>}
      {loading ? <div className="notification-panel-state" role="status">Loading notifications…</div> : notifications.length ? <>
        <div className="notification-list">{notifications.map((notification) => <article className="notification-item" key={notification.id}>
          <div><strong>{notification.title}</strong><p>{notification.body || notification.type.replaceAll('_', ' ')}</p><time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time></div>
          <button type="button" onClick={() => markRead(notification)} disabled={saving}>Mark read</button>
        </article>)}</div>
        <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={saving}>Mark all as read</button>
      </> : !error && <div className="notification-panel-state"><strong>You’re all caught up</strong><span>No unread notifications.</span></div>}
    </section>}
  </div>;
}