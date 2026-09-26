import Card from '../common/Card';
import Button from '../common/Button';

export default function AIAssistant() {
  return (
    <Card className="panel-card ai-panel">
      <div className="ai-badge">AI</div>
      <div className="ai-copy">
        <h3>Planwise AI</h3>
        <p>Get intelligent insights about your projects, tasks, deadlines and risks.</p>
      </div>

      <div className="ai-actions">
        <Button variant="primary" size="md">Ask AI</Button>
        <Button variant="secondary" size="md">Analyze Project</Button>
        <Button variant="secondary" size="md">Find Risks</Button>
        <Button variant="secondary" size="md">Generate Plan</Button>
      </div>
    </Card>
  );
}
