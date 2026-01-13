import { useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from './socketClient';
import './ChatWidget.css';

const defaultRooms = [
  { label: 'Team', value: 'team' },
  { label: 'Admin', value: 'direct' },
];

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [roomType, setRoomType] = useState('team');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const socketRef = useRef(null);

  const socket = useMemo(() => {
    if (!open) return null;
    socketRef.current = createSocket();
    return socketRef.current;
  }, [open]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleReceive = (payload) => {
      setMessages((prev) => [...prev, payload]);
    };

    socket.on('receiveMessage', handleReceive);
    socket.on('taskAssigned', (assignment) => {
      setMessages((prev) => [
        ...prev,
        { id: `assignment-${assignment.id}`, message: `Task assigned: ${assignment.cardId}`, type: 'system', createdAt: Date.now() },
      ]);
    });
    socket.on('taskStatusUpdated', (assignment) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assignment-status-${assignment.id}`,
          message: `Task status updated: ${assignment.status}`,
          type: 'system',
          createdAt: Date.now(),
        },
      ]);
    });

    return () => {
      socket.off('receiveMessage', handleReceive);
      socket.disconnect();
    };
  }, [socket]);

  const joinRoom = () => {
    if (!socket || !roomIdInput) return;
    const roomId =
      roomType === 'team' ? `team:${roomIdInput.trim()}` : `admin:${roomIdInput.trim()}`;
    socket.emit('joinRoom', { roomId, type: roomType }, (res) => {
      if (res?.error) {
        setMessages((prev) => [...prev, { id: Date.now(), message: res.error, type: 'error', createdAt: Date.now() }]);
      }
    });
  };

  const send = () => {
    if (!socket || !message || !roomIdInput) return;
    const roomId =
      roomType === 'team' ? `team:${roomIdInput.trim()}` : `admin:${roomIdInput.trim()}`;
    socket.emit('sendMessage', { roomId, message, type: roomType }, () => {});
    setMessage('');
  };

  return (
    <>
      <button className="chat-widget-button" onClick={() => setOpen((prev) => !prev)} aria-label="Open chat">
        💬
      </button>
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-left">
            <div className="chat-widget-header">
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                {defaultRooms.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Room ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
              />
              <button onClick={joinRoom}>Join</button>
            </div>
            <div className="chat-widget-messages">
              {messages.map((m) => (
                <div key={m.id || m.createdAt} className={`chat-widget-message chat-type-${m.type || 'text'}`}>
                  <div>{m.message}</div>
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
            <div className="chat-widget-input">
              <input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button onClick={send}>Send</button>
            </div>
          </div>
          <div className="chat-widget-right">
            <div className="chat-widget-placeholder">AI / Ollama panel (placeholder)</div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
