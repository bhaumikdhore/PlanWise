import Card from '../common/Card';
import Avatar from '../common/Avatar';

export default function TeamMembers({ members }) {
  return (
    <Card className="panel-card team-panel">
      <div className="panel-header team-header">
        <h3>Team Members</h3>
        <button type="button" className="text-btn small">View All</button>
      </div>

      <div className="team-stack">
        {members.map((member, index) => (
          <div key={member.name} className="member-avatar" style={{ zIndex: members.length - index }}>
            <Avatar initials={member.initials} size="lg" active={index < 4} />
          </div>
        ))}
        <button type="button" className="member-add">+</button>
      </div>

      <div className="team-status-row">
        <span className="team-status-dot"></span>
        <span>{members.length} accessible members</span>
      </div>
    </Card>
  );
}
