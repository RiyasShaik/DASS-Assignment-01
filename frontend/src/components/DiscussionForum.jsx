import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  deleteDiscussionMessage,
  getDiscussionMessages,
  pinDiscussionMessage,
  postDiscussionMessage,
  reactDiscussionMessage,
} from '../api/events';
import { useAuth } from '../context/AuthContext';

const ENDPOINT = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const QUICK_REACTIONS = ['👍', '🔥', '👏'];

function resolveUserId(userRef) {
  if (!userRef) return '';
  if (typeof userRef === 'string') return userRef;
  return String(userRef._id || userRef.id || '');
}

function resolveEventId(eventRef) {
  if (!eventRef) return '';
  if (typeof eventRef === 'string') return eventRef;
  return String(eventRef._id || eventRef.id || eventRef);
}

function formatSender(msg) {
  if (msg.userId?.role === 'organizer') {
    return msg.userId?.organizerName || 'Organizer';
  }
  const name = `${msg.userId?.firstName || ''} ${msg.userId?.lastName || ''}`.trim();
  return name || msg.userId?.email || 'User';
}

function reactionsToText(reactions = []) {
  return reactions.map((reaction) => `${reaction.emoji} ${reaction.users?.length || 0}`).join('  ');
}

function DiscussionForum({ eventId, canModerate }) {
  const { token, user } = useAuth();
  const typingTimeoutRef = useRef(new Map());

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [isAnnouncement, setIsAnnouncement] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const me = resolveUserId(user);

  useEffect(() => {
    let active = true;
    getDiscussionMessages(eventId)
      .then((res) => {
        if (!active) return;
        setMessages(res.data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.message || 'Failed to load discussion');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(ENDPOINT, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const safeEventId = String(eventId);
    socket.emit('discussion:join', { eventId: safeEventId });

    const onMessage = (message) => {
      if (resolveEventId(message.eventId) !== safeEventId) return;

      setMessages((prev) => {
        const index = prev.findIndex((entry) => entry._id === message._id);
        if (index === -1) return [...prev, message];
        const next = [...prev];
        next[index] = message;
        return next;
      });

      const sender = resolveUserId(message.userId);
      if (sender && sender !== me) {
        setNewMessageCount((count) => count + 1);
      }
    };

    const onDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((entry) => entry._id !== messageId));
      setReplyTarget((current) => (current && current._id === messageId ? null : current));
    };

    const onPinned = ({ messageId, isPinned: pinned }) => {
      setMessages((prev) =>
        prev
          .map((entry) => (entry._id === messageId ? { ...entry, isPinned: pinned } : entry))
          .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(a.createdAt) - new Date(b.createdAt))
      );
    };

    const onReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((entry) => (entry._id === messageId ? { ...entry, reactions } : entry))
      );
    };

    const onTyping = ({ userId, eventId: incomingEventId, isTyping }) => {
      if (String(incomingEventId) !== safeEventId) return;
      if (!userId || String(userId) === me) return;

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(String(userId));
        else next.delete(String(userId));
        return next;
      });

      const existingTimeout = typingTimeoutRef.current.get(String(userId));
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      if (isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(String(userId));
            return next;
          });
          typingTimeoutRef.current.delete(String(userId));
        }, 2200);
        typingTimeoutRef.current.set(String(userId), timeout);
      }
    };

    const onPresence = ({ userId, eventId: incomingEventId, status }) => {
      if (String(incomingEventId) !== safeEventId) return;
      if (!userId) return;

      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'online') next.add(String(userId));
        if (status === 'offline') next.delete(String(userId));
        return next;
      });
    };

    const onDiscussionError = ({ eventId: incomingEventId, message }) => {
      if (String(incomingEventId) !== safeEventId) return;
      setError(message || 'Discussion access error');
    };

    socket.on('discussion:message', onMessage);
    socket.on('discussion:deleted', onDeleted);
    socket.on('discussion:pinned', onPinned);
    socket.on('discussion:reaction', onReaction);
    socket.on('discussion:typing', onTyping);
    socket.on('discussion:presence', onPresence);
    socket.on('discussion:error', onDiscussionError);

    return () => {
      socket.emit('discussion:leave', { eventId: safeEventId });
      socket.off('discussion:message', onMessage);
      socket.off('discussion:deleted', onDeleted);
      socket.off('discussion:pinned', onPinned);
      socket.off('discussion:reaction', onReaction);
      socket.off('discussion:typing', onTyping);
      socket.off('discussion:presence', onPresence);
      socket.off('discussion:error', onDiscussionError);
      socket.disconnect();
      socketRef.current = null;

      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, [token, eventId, me]);

  const messageById = useMemo(() => {
    return new Map(messages.map((message) => [String(message._id), message]));
  }, [messages]);

  const typingText = useMemo(() => {
    if (typingUsers.size === 0) return '';
    if (typingUsers.size === 1) return '1 user is typing...';
    return `${typingUsers.size} users are typing...`;
  }, [typingUsers]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      await postDiscussionMessage(eventId, {
        content: text.trim(),
        parentId: replyTarget?._id || undefined,
        isAnnouncement: canModerate ? Boolean(isAnnouncement) : false,
      });
      setText('');
      setReplyTarget(null);
      setIsAnnouncement(false);
      setError('');
      socketRef.current?.emit('discussion:typing', { eventId, isTyping: false });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send message');
    }
  };

  const onDelete = async (messageId) => {
    try {
      await deleteDiscussionMessage(eventId, messageId);
      setMessages((prev) => prev.filter((entry) => entry._id !== messageId));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete message');
    }
  };

  const onPin = async (messageId) => {
    try {
      await pinDiscussionMessage(eventId, messageId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to pin/unpin message');
    }
  };

  const onReact = async (messageId, emoji) => {
    try {
      await reactDiscussionMessage(eventId, messageId, emoji);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to react to message');
    }
  };

  return (
    <section className="card">
      <div className="card-row">
        <h3>Live Discussion Forum</h3>
        <span className="muted small">Online: {onlineUsers.size}</span>
      </div>

      {newMessageCount > 0 ? (
        <div className="notice">
          <p>
            <strong>{newMessageCount}</strong> new message{newMessageCount > 1 ? 's' : ''} received.
          </p>
          <button type="button" className="btn ghost" onClick={() => setNewMessageCount(0)}>
            Mark as seen
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">Loading discussion...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {replyTarget ? (
        <div className="notice">
          <p>
            Replying to <strong>{formatSender(replyTarget)}</strong>: {replyTarget.content}
          </p>
          <button type="button" className="btn ghost" onClick={() => setReplyTarget(null)}>
            Cancel reply
          </button>
        </div>
      ) : null}

      <form className="inline-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            socketRef.current?.emit('discussion:typing', { eventId, isTyping: Boolean(e.target.value.trim()) });
          }}
          placeholder={canModerate ? 'Post an update, response, or announcement' : 'Post a message or question'}
        />
        {canModerate ? (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={isAnnouncement}
              onChange={(e) => setIsAnnouncement(e.target.checked)}
            />
            Announcement
          </label>
        ) : null}
        <button type="submit" className="btn">
          Send
        </button>
      </form>

      {typingText ? <p className="muted small">{typingText}</p> : null}

      <div className="discussion-list">
        {messages
          .slice()
          .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(a.createdAt) - new Date(b.createdAt))
          .map((message) => {
            const parentKey = resolveUserId(message.parentId) || String(message.parentId || '');
            const parent = messageById.get(parentKey);

            return (
              <article key={message._id} className="discussion-item">
                <div className="card-row">
                  <strong>{formatSender(message)}</strong>
                  <div className="row-gap">
                    {message.isAnnouncement ? <span className="pill">Announcement</span> : null}
                    {message.isPinned ? <span className="pill">Pinned</span> : null}
                    <span className="muted small">{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {parent ? (
                  <p className="muted small">
                    Replying to {formatSender(parent)}: {String(parent.content || '').slice(0, 80)}
                  </p>
                ) : null}

                <p>{message.content}</p>
                <div className="card-row">
                  <span className="muted small">{reactionsToText(message.reactions)}</span>
                  <div className="row-gap">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={`${message._id}-${emoji}`}
                        type="button"
                        className="btn ghost"
                        onClick={() => onReact(message._id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setReplyTarget(message)}
                    >
                      Reply
                    </button>
                    {canModerate ? (
                      <>
                        <button type="button" className="btn ghost" onClick={() => onPin(message._id)}>
                          Pin/Unpin
                        </button>
                        <button type="button" className="btn danger" onClick={() => onDelete(message._id)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        {!loading && messages.length === 0 ? <p className="muted">No discussion yet.</p> : null}
      </div>
    </section>
  );
}

export default DiscussionForum;
