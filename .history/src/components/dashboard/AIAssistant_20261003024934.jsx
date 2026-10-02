import { useEffect, useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { getProjects } from '../../services/projects/projectService';
import { getAiConversations, getAiMessages, sendAiMessage } from '../../services/ai/aiService';

const prompts = {
  'Ask AI': '',
  'Analyze Project': 'Help me analyze my project. Ask me for the details you need.',
  'Find Risks': 'Help me identify project risks based on information I provide.',
  'Generate Plan': 'Help me create a practical project plan. Ask clarifying questions first.'
};

export default function AIAssistant({ session }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const user = {
      id: session.user.id,
      profile: {
        full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
        email: session.user.email || ''
      }
    };
    Promise.all([getProjects(user), getAiConversations(session.user.id)]).then(([projectRows, conversationRows]) => {
      if (!active) return;
      setProjects(projectRows.filter((project) => !project.archived));
      setConversations(conversationRows);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load AI conversations.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session.user.id]);

  const selectConversation = async (id) => {
    setConversationId(id);
    setMessages([]);
    setError('');
    if (!id) return;
    const conversation = conversations.find((item) => item.id === id);
    setProjectId(conversation?.project_id || '');
    setLoadingMessages(true);
    try {
      setMessages(await getAiMessages(id));
    } catch (loadError) {
      setError(loadError.message || 'Could not load this conversation.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const startPrompt = (prompt) => {
    setOpen(true);
    setError('');
    setDraft(prompt);
    if (!conversationId) setMessages([]);
  };

  const send = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    const optimisticId = `pending-${Date.now()}`;
    setMessages((current) => [...current, { id: optimisticId, role: 'user', content }]);
    setDraft('');
    try {
      const result = await sendAiMessage({ conversationId, projectId, message: content });
      setConversationId(result.conversationId);
      setMessages((current) => [...current.filter((message) => message.id !== optimisticId), ...result.messages]);
      const updatedConversations = await getAiConversations(session.user.id);
      setConversations(updatedConversations);
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setDraft(content);
      setError(sendError.message || 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const newConversation = () => {
    setConversationId('');
    setProjectId('');
    setMessages([]);
    setDraft('');
    setError('');
  };

  return (
    <Card className="panel-card ai-panel">
      <div className="ai-badge">AI</div>
      <div className="ai-copy">
        <h3>Planwise AI</h3>
        <p>Ask planning questions and keep conversations connected to your projects.</p>
      </div>

      <div className="ai-actions">
        {Object.entries(prompts).map(([label, prompt]) => <Button key={label} variant={label === 'Ask AI' ? 'primary' : 'secondary'} size="md" onClick={() => startPrompt(prompt)}>{label}</Button>)}
      </div>

      {open && <section className="ai-chat" aria-label="Planwise AI conversation">
        <div className="ai-chat-controls">
          <label>Conversation<select value={conversationId} onChange={(event) => selectConversation(event.target.value)} disabled={loading || sending}><option value="">New conversation</option>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select></label>
          <label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={Boolean(conversationId) || sending}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <Button type="button" variant="secondary" size="sm" onClick={newConversation}>New chat</Button>
        </div>
        {error && <p className="ai-chat-error" role="alert">{error}</p>}
        {loading && <div className="ai-chat-empty" role="status">Loading conversations…</div>}
        {!loading && loadingMessages && <div className="ai-chat-empty" role="status">Loading conversation…</div>}
        {!loading && !loadingMessages && <div className="ai-chat-messages" aria-live="polite">
          {messages.map((message) => <article className={`ai-chat-message ai-message-${message.role}`} key={message.id}><strong>{message.role === 'assistant' ? 'Planwise AI' : 'You'}</strong><p>{message.content}</p></article>)}
          {!messages.length && <div className="ai-chat-empty">Choose a project if useful, then ask a question.</div>}
          {sending && <div className="ai-chat-empty" role="status">Planwise AI is thinking…</div>}
        </div>}
        <form className="ai-chat-form" onSubmit={send}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="2" maxLength="4000" placeholder="Ask Planwise AI…" aria-label="Message Planwise AI" disabled={loading || loadingMessages || sending} />
          <Button type="submit" disabled={loading || loadingMessages || sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</Button>
        </form>
      </section>}
    </Card>
  );
}
