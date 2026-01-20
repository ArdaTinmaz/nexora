import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from './socketClient';
import { channelApi } from '../api/channelApi';
import { teamApi } from '../api/teamApi';
import userApi from '../api/userApi';
import './ChatWidgetLite.css';

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatWidgetLite = () => {
  const socketRef = useRef(null);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [channels, setChannels] = useState([]);
  const [invites, setInvites] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageLimit, setMessageLimit] = useState(50);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTeam, setNewChannelTeam] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [channelError, setChannelError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  const socket = useMemo(() => {
    const s = createSocket();
    socketRef.current = s;
    return s;
  }, []);

  const selectedTeamForChannel = useMemo(
    () => teams.find((t) => t.id === newChannelTeam) || null,
    [teams, newChannelTeam]
  );
  const leaderTeams = useMemo(() => teams.filter((t) => t.role === 'team_leader'), [teams]);
  const canCreateAnyChannel = leaderTeams.length > 0;
  const canCreateChannel = !newChannelTeam || selectedTeamForChannel?.role === 'team_leader';

  const inviteOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    teamMembers.forEach((m) => {
      if (!m?.id || seen.has(m.id)) return;
      seen.add(m.id);
      list.push({
        id: m.id,
        label: `${m.name} (${m.role})`,
        role: m.role,
      });
    });
    return list;
  }, [teamMembers]);

  const addMessageUnique = useCallback((msg) => {
    if (!msg) return;
    const key = msg.id || `${msg.channelId}-${msg.createdAt}`;
    setMessages((prev) => {
      if (prev.some((item) => (item.id || `${item.channelId}-${item.createdAt}`) === key)) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (e) => {
      const panelEl = panelRef.current;
      const toggleEl = toggleRef.current;
      if (panelEl?.contains(e.target) || toggleEl?.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const load = async () => {
      try {
        const [channelList, inviteList, teamList, profile] = await Promise.all([
          channelApi.list(),
          channelApi.invites(),
          teamApi.myTeams(),
          userApi.getProfile(),
        ]);
        setChannels(channelList || []);
        setInvites(inviteList || []);
        setTeams(teamList || []);
        setCurrentUserId(profile?.id || '');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };
    load();
    setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!leaderTeams.length) {
      setNewChannelTeam('');
      return;
    }
    if (!leaderTeams.find((t) => t.id === newChannelTeam)) {
      setNewChannelTeam(leaderTeams[0].id);
    }
  }, [leaderTeams, newChannelTeam]);

  useEffect(() => {
    if (!selectedChannel?.teamId) {
      setTeamMembers([]);
      setMemberError('');
      return;
    }

    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        setMemberError('');
        const res = await teamApi.members(selectedChannel.teamId);
        setTeamMembers(res);
      } catch (err) {
        setMemberError(err.message);
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [selectedChannel]);

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
        addMessageUnique(payload);
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
  }, [socket, open, selectedChannel, addMessageUnique]);

  const joinChannel = async (channel) => {
    if (!channel || !socket) return;
    setSelectedChannel(channel);
    setMessageLimit(50);
    try {
      socket.emit('joinChannel', { channelId: channel.id }, async (res) => {
        if (res?.error) {
          // eslint-disable-next-line no-console
          console.error(res.error);
          return;
        }
        const history = await channelApi.messages(channel.id, 50);
        setMessages(history);
        setHasMoreMessages(history.length === 50);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedChannel) return;
    socket.emit('sendChannelMessage', { channelId: selectedChannel.id, message: message.trim() });
    setMessage('');
  };

  const submitChannel = async () => {
    if (!newChannelName.trim() || !newChannelTeam) return;
    if (!canCreateChannel) {
      setChannelError('Bu takımda kanal açma yetkiniz yok (team_leader gerekli)');
      return;
    }
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

  const loadMoreMessages = async () => {
    if (!selectedChannel) return;
    const nextLimit = messageLimit + 50;
    try {
      const history = await channelApi.messages(selectedChannel.id, nextLimit);
      setMessages(history);
      setMessageLimit(nextLimit);
      setHasMoreMessages(history.length === nextLimit);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const currentUserRole = useMemo(
    () => inviteOptions.find((u) => u.id === currentUserId)?.role || '',
    [inviteOptions, currentUserId]
  );
  const canInvite = currentUserRole === 'team_leader';

  return (
    <>
      <button
        className="chat-widget-lite-button"
        ref={toggleRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open chat"
      >
        💬
        {unread > 0 && <span className="chat-widget-lite-badge">{unread}</span>}
      </button>
      {open && (
        <div className="chat-widget-lite-panel" ref={panelRef}>
          <div className="chat-widget-lite-left">
            <div className="chat-widget-lite-left-header">
              <div className="chat-widget-lite-title">
                <span>Channels</span>
                <button
                  className="chat-widget-lite-add"
                  onClick={submitChannel}
                  disabled={creating || !canCreateAnyChannel}
                  title="Create channel"
                >
                  +
                </button>
              </div>
              {channelError && <div className="chat-widget-lite-error-text">{channelError}</div>}
              {canCreateAnyChannel && (
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
                    {leaderTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.role})
                      </option>
                    ))}
                  </select>
                  {!canCreateChannel && (
                    <div className="chat-widget-lite-error-text">
                      Bu takımda sadece team_leader kanal oluşturabilir.
                    </div>
                  )}
                </div>
              )}
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
                  {canInvite && (
                    <div className="chat-widget-lite-invite">
                      <select
                        value={inviteUserId}
                        onChange={(e) => setInviteUserId(e.target.value)}
                        disabled={loadingMembers || inviteOptions.length === 0}
                      >
                        <option value="">Invite user</option>
                        {inviteOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={sendInvite} disabled={!inviteUserId}>
                        Invite
                      </button>
                    </div>
                  )}
                </div>
                <div className="chat-widget-lite-messages">
                  {memberError && <div className="chat-widget-lite-error-text">{memberError}</div>}
                  {canInvite && hasMoreMessages && (
                    <button className="chat-widget-lite-load-more" onClick={loadMoreMessages}>
                      Daha eski mesajları yükle (+50)
                    </button>
                  )}
                  <div className="chat-widget-lite-subtle">Gösterilen son {messages.length} mesaj</div>
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
