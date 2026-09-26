import Card from '../common/Card';

export default function UpcomingMeetings({ meetings }) {
  return (
    <Card className="panel-card meetings-panel">
      <div className="panel-header meeting-header">
        <h3>Upcoming Meetings</h3>
        <button type="button" className="text-btn small">View All</button>
      </div>

      <div className="meeting-list">
        {meetings.map((meeting) => (
          <div key={meeting.title} className="meeting-item">
            <div className={`meeting-icon ${meeting.color}`}>◉</div>
            <div className="meeting-copy">
              <strong>{meeting.title}</strong>
              <span>{meeting.time}</span>
            </div>
            <span className={`meeting-tag ${meeting.status === 'Today' ? 'is-today' : 'is-soon'}`}>{meeting.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
