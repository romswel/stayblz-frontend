import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Conversation, ConversationPreview } from '../types';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Messages() {
  const [previews, setPreviews] = useState<ConversationPreview[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [threadOpen, setThreadOpen] = useState(false); // mobile: show thread pane
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    api
      .get<{ conversations: ConversationPreview[] }>('/api/messages')
      .then((d) => {
        setPreviews(d.conversations);
        if (d.conversations.length > 0) openConversation(d.conversations[0].id, false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load messages.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openConversation(id: string, focus = true) {
    api
      .get<{ conversation: Conversation }>(`/api/messages/${id}`)
      .then((d) => {
        setActive(d.conversation);
        if (focus) setThreadOpen(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open conversation.'));
  }

  function handleSend() {
    if (!draft.trim() || !active) return;
    // Local echo only — real send arrives with the messaging backend.
    setActive({
      ...active,
      messages: [
        ...active.messages,
        {
          id: `local-${Date.now()}`,
          from: 'You',
          body: draft.trim(),
          sentAt: new Date().toISOString(),
          mine: true
        }
      ]
    });
    setDraft('');
  }

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">stable // communications</div>
        <h1>Messages</h1>
        <p className="sub">Conversations with your stable, riders, and suppliers</p>
      </header>

      <div className={`panel messages-layout${threadOpen ? ' thread-open' : ''}`}>
        <div className="convo-list">
          {loading && <div className="loading">Loading conversations…</div>}
          {error && !loading && <div className="empty">{error}</div>}
          {!loading && !error && previews.length === 0 && (
            <div className="empty">No conversations yet. New messages will appear here.</div>
          )}
          {previews.map((c) => (
            <button
              key={c.id}
              className={`convo-item${active?.id === c.id ? ' active' : ''}`}
              onClick={() => openConversation(c.id)}
            >
              <div className="convo-top">
                <span className="convo-title">{c.title}</span>
                <span className="convo-time">
                  {c.unread > 0 ? <span className="unread-dot">{c.unread}</span> : timeLabel(c.lastMessageAt)}
                </span>
              </div>
              <div className="convo-preview">{c.lastMessage}</div>
            </button>
          ))}
        </div>

        <div className="thread">
          {active ? (
            <>
              <div className="thread-head">
                <button className="thread-back" onClick={() => setThreadOpen(false)}>
                  Back
                </button>
                <div>
                  <div className="t">{active.title}</div>
                  <div className="p">{active.participants.join(', ')}</div>
                </div>
              </div>
              <div className="thread-body">
                {active.messages.map((m) => (
                  <div key={m.id} className={`bubble${m.mine ? ' mine' : ''}`}>
                    {!m.mine && <div className="meta">{m.from}</div>}
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              <div className="thread-compose">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Write a message"
                  aria-label="Write a message"
                />
                <button className="btn btn-quiet" onClick={handleSend}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="empty">Select a conversation to read it.</div>
          )}
        </div>
      </div>
    </>
  );
}
