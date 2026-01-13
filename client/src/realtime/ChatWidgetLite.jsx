import { useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from './socketClient';
import { channelApi } from '../api/channelApi';
import { teamApi } from '../api/teamApi';
import './ChatWidgetLite.css';

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatWidgetLite = () => {
  const socketRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [channels, setChannels] = useState([]);
  const [invites, setInvites] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTeam, setNewChannelTeam] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [channelError, setChannelError] = useState('');

  const socket = useMemo(() => {
    const s = createSocket();
    socketRef.current = s;
    return s;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const load = async () => {
      try {
        const [channelList, inviteList, teamList] = await Promise.all([
          channelApi.list(),
          channelApi.invites(),
          teamApi.myTeams(),
        ]);
        setChannels(channelList || []);
        setInvites(inviteList || []);
        setTeams(teamList || []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };
    load();
    setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleChannelCreated = (channel) => {
      setChannels((prev) => {
        const exists = prev.some((c) => c.id === channel.id);
        return exists ? prev : [...prev, channel];
      });
    };

    const handleChannelInvited = (invite) => {
      setInvites((prev) => [...prev, invite]);
      if (!open) setUnread((c) => c + 1);
    };

    const handleChannelMessage = (payload) => {
      if (selectedChannel && payload.channelId === selectedChannel.id) {
        setMessages((prev) => [...prev, payload]);
      }
      if (!open || !selectedChannel || payload.channelId !== selectedChannel.id) {
        setUnread((c) => c + 1);
      }
    };

    socket.on('channelCreated', handleChannelCreated);
    socket.on('channelInvited', handleChannelInvited);
    socket.on('channelMemberJoined', () => {});
    socket.on('receiveChannelMessage', handleChannelMessage);

    return () => {
      socket.off('channelCreated', handleChannelCreated);
      socket.off('channelInvited', handleChannelInvited);
      socket.off('receiveChannelMessage', handleChannelMessage);
    };
  }, [socket, open, selectedChannel]);

  const joinChannel = async (channel) => {
    if (!channel || !socket) return;
    setSelectedChannel(channel);
    try {
      socket.emit('joinChannel', { channelId: channel.id }, async (res) => {
        if (res?.error) {
          // eslint-disable-next-line no-console
          console.error(res.error);
          return;
        }
        const history = await channelApi.messages(channel.id);
        setMessages(history);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedChannel) return;
    socket.emit(
      'sendChannelMessage',
      { channelId: selectedChannel.id, message: message.trim() },
      (res) => {
        if (!res?.error) {
          setMessages((prev) => [...prev, res.message]);
        }
      }
    );
    setMessage('');
  };

  const submitChannel = async () => {
    if (!newChannelName.trim() || !newChannelTeam) return;
    setCreating(true);
    try {
      const created = await channelApi.create({ name: newChannelName, teamId: newChannelTeam });
      setChannels((prev) => [...prev, created]);
      setNewChannelName('');
      setNewChannelTeam('');
      setCreating(false);
      setChannelError('');
    } catch (err) {
      setCreating(false);
      setChannelError(err.message || 'Channel create failed');
    }
  };

  const acceptInvite = async (invite) => {
    try {
      await channelApi.acceptInvite(invite.channelId);
      setInvites((prev) => prev.filter((i) => i.channelId !== invite.channelId));
      // refresh channels
      const channelList = await channelApi.list();
      setChannels(channelList || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const sendInvite = async () => {
    if (!inviteUserId.trim() || !selectedChannel) return;
    try {
      await channelApi.inviteUser(selectedChannel.id, inviteUserId.trim());
      setInviteUserId('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <>
      <button
        className="chat-widget-lite-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open chat"
      >
        💬
        {unread > 0 && <span className="chat-widget-lite-badge">{unread}</span>}
      </button>
      {open && (
        <div className="chat-widget-lite-panel">
          <div className="chat-widget-lite-left">
            <div className="chat-widget-lite-left-header">
              <div className="chat-widget-lite-title">
                <span>Channels</span>
                <button
                  className="chat-widget-lite-add"
                  onClick={submitChannel}
                  disabled={creating}
                  title="Create channel"
                >
                  +
                </button>
              </div>
              {channelError && <div className="chat-widget-lite-error-text">{channelError}</div>}
              <div className="chat-widget-lite-create">
                <input
                  placeholder="Channel name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                />
                <select
                  value={newChannelTeam}
                  onChange={(e) => setNewChannelTeam(e.target.value)}
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="chat-widget-lite-channel-list">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className={`chat-widget-lite-channel ${
                    selectedChannel?.id === channel.id ? 'active' : ''
                  }`}
                  onClick={() => joinChannel(channel)}
                >
                  <div className="chat-widget-lite-channel-name"># {channel.name}</div>
                  <div className="chat-widget-lite-channel-meta">Team: {channel.teamId}</div>
                </button>
              ))}
              {invites.length > 0 && (
                <div className="chat-widget-lite-invites">
                  <div className="chat-widget-lite-invites-title">Invites</div>
                  {invites.map((invite) => (
                    <div key={invite.id} className="chat-widget-lite-invite-row">
                      <span>Channel: {invite.channelId}</span>
                      <button onClick={() => acceptInvite(invite)}>Accept</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="chat-widget-lite-right">
            {selectedChannel ? (
              <div className="chat-widget-lite-chat">
                <div className="chat-widget-lite-chat-header">
                  <div className="chat-widget-lite-chat-title"># {selectedChannel.name}</div>
                  <div className="chat-widget-lite-invite">
                    <input
                      placeholder="Invite userId"
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                    />
                    <button onClick={sendInvite}>Invite</button>
                  </div>
                </div>
                <div className="chat-widget-lite-messages">
                  {messages.map((entry) => (
                    <div
                      key={entry.id || entry.createdAt}
                      className={`chat-widget-lite-message chat-widget-lite-${entry.type || 'text'}`}
                    >
                      <div>{entry.message}</div>
                      <span>{formatTime(entry.createdAt || Date.now())}</span>
                    </div>
                  ))}
                </div>
                <div className="chat-widget-lite-input">
                  <input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button onClick={sendMessage}>Send</button>
                </div>
              </div>
            ) : (
              <div className="chat-widget-lite-placeholder">
                Kanallardan birini seç veya yeni kanal oluştur.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidgetLite;
