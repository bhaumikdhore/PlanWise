import Card from '../common/Card';

export default function CalendarCard({ days, items, monthLabel }) {
  return (
    <Card className="panel-card calendar-panel">
      <div className="calendar-section">
        <div className="panel-header calendar-header">
          <h3>Calendar</h3>
          <div className="calendar-nav">
            <button type="button">‹</button>
            <button type="button">›</button>
          </div>
        </div>

        <div className="month-title">{monthLabel}</div>

        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}

          {days.map((day, index) => (
            <div key={`${day.date}-${index}`} className={`calendar-day ${day.selected ? 'selected' : ''} ${day.muted ? 'muted' : ''}`}>
              <span>{day.date}</span>
              {day.selected && <i className="dot-indicator" />}
            </div>
          ))}
        </div>
      </div>

      <div className="schedule-section">
        <div className="panel-header schedule-header">
          <h3>Today&apos;s Schedule</h3>
          <button type="button" className="text-btn small">+ Add</button>
        </div>

        <div className="timeline-list">
          {items.map((item, index) => (
            <div key={item.title} className="timeline-item">
              <div className="timeline-rail">
                <span className={`timeline-dot ${item.tone}`}></span>
                {index < items.length - 1 && <span className="timeline-line"></span>}
              </div>
              <div className="timeline-content">
                <div className="timeline-time">{item.time}</div>
                <div className="timeline-title">{item.title}</div>
              </div>
            </div>
          ))}
          {!items.length && <div className="project-detail-empty">No meetings scheduled for today.</div>}
        </div>
      </div>
    </Card>
  );
}
