import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from './socketClient';
import { channelApi } from '../api/channelApi';
import { teamApi } from '../api/teamApi';
import userApi from '../api/userApi';
import { API_ORIGIN } from '../config';
import './ChatWidgetLite.css';

const DELETED_MESSAGE_TEXT = 'This message was deleted.';
const MESSAGE_PREVIEW_CHAR_LIMIT = 220;

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getOrdinalSuffix = (day) => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

const formatDateDetail = (timestamp) => {
  const date = new Date(timestamp);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${month} ${day}${getOrdinalSuffix(day)} at ${time}`;
};

const tokenizeMentionName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

const getInitials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

const resolveAvatarUrl = (avatarURL) => {
  if (!avatarURL) return '';
  if (/^(?:https?:|data:|blob:|file:)/i.test(avatarURL)) return avatarURL;
  if (avatarURL.startsWith('/')) return `${API_ORIGIN}${avatarURL}`;
  if (avatarURL.startsWith('uploads/')) return `${API_ORIGIN}/${avatarURL}`;
  return `${API_ORIGIN}/uploads/${avatarURL}`;
};

const ChatWidgetLite = () => {
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTeam, setNewChannelTeam] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [channelError, setChannelError] = useState('');
  const [actionError, setActionError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserAvatarURL, setCurrentUserAvatarURL] = useState('');
  const [activeMenuMessageId, setActiveMenuMessageId] = useState('');
  const [activeMenuChannelId, setActiveMenuChannelId] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingMessageText, setEditingMessageText] = useState('');
  const [savingMessageId, setSavingMessageId] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState({});
  const [channelModalMode, setChannelModalMode] = useState('');
  const [channelModalTarget, setChannelModalTarget] = useState(null);
  const [channelModalName, setChannelModalName] = useState('');
  const [channelModalLoading, setChannelModalLoading] = useState(false);
  const [channelModalError, setChannelModalError] = useState('');

  const socket = useMemo(() => {
    return createSocket();
  }, []);

  useEffect(() => () => socket.disconnect(), [socket]);

  const teamNameById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      map.set(team.id, team.name);
    });
    return map;
  }, [teams]);

  const selectedTeamForChannel = useMemo(
    () => teams.find((t) => t.id === newChannelTeam) || null,
    [teams, newChannelTeam]
  );
  const leaderTeams = useMemo(() => teams.filter((t) => t.role === 'team_leader'), [teams]);
  const canCreateAnyChannel = leaderTeams.length > 0;
  const canCreateChannel = Boolean(selectedTeamForChannel && selectedTeamForChannel.role === 'team_leader');

  const memberById = useMemo(() => {
    const map = new Map();
    teamMembers.forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }, [teamMembers]);

  const inviteOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    teamMembers.forEach((member) => {
      if (!member?.id || member.id === currentUserId || seen.has(member.id)) return;
      seen.add(member.id);
      list.push({
        id: member.id,
        label: `${member.name} (${member.role})`,
      });
    });
    return list;
  }, [teamMembers, currentUserId]);

  const currentTeamRole = useMemo(() => {
    if (!selectedChannel) return '';
    const memberRole = teamMembers.find((member) => member.id === currentUserId)?.role;
    if (memberRole) return memberRole;
    return teams.find((team) => team.id === selectedChannel.teamId)?.role || '';
  }, [selectedChannel, teamMembers, currentUserId, teams]);
  const canInvite = currentTeamRole === 'team_leader';
  const canManageChannel = useCallback(
    (channel) => teams.some((team) => team.id === channel.teamId && team.role === 'team_leader'),
    [teams]
  );
  const mentionLookup = useMemo(() => {
    const map = new Map();
    teamMembers.forEach((member) => {
      const token = tokenizeMentionName(member.name);
      if (!token) return;
      map.set(token.toLowerCase(), member.name);
    });
    return map;
  }, [teamMembers]);
  const mentionMatch = useMemo(() => message.match(/(?:^|\s)@([^\s@]*)$/), [message]);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() || '';
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    return teamMembers
      .filter((member) => member.id !== currentUserId)
      .map((member) => ({
        id: member.id,
        name: member.name,
        token: tokenizeMentionName(member.name),
      }))
      .filter((member) => member.token && member.token.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionMatch, mentionQuery, teamMembers, currentUserId]);
  const pinnedMessage = useMemo(() => {
    if (!selectedChannel?.pinnedMessageId) return null;
    return (
      messages.find((entry) => entry.id === selectedChannel.pinnedMessageId) ||
      selectedChannel?.pinnedMessage ||
      null
    );
  }, [messages, selectedChannel]);

  const filteredChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((channel) => {
      const name = String(channel.name || '').toLowerCase();
      const teamName = String(teamNameById.get(channel.teamId) || '').toLowerCase();
      return name.includes(query) || teamName.includes(query);
    });
  }, [channelSearch, channels, teamNameById]);

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

  const upsertMessage = useCallback((payload) => {
    if (!payload) return;
    setMessages((prev) => {
      const exists = prev.some((item) => item.id === payload.id);
      if (!exists) return [...prev, payload];
      return prev.map((item) => (item.id === payload.id ? { ...item, ...payload } : item));
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
        const profileUser = profile?.user || profile || {};
        setChannels(channelList || []);
        setInvites(inviteList || []);
        setTeams(teamList || []);
        setCurrentUserId(profileUser?.id || '');
        setCurrentUserName(profileUser?.name || '');
        setCurrentUserAvatarURL(profileUser?.avatarURL || '');
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
    if (!leaderTeams.find((team) => team.id === newChannelTeam)) {
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
    setExpandedMessageIds((prev) => {
      const next = {};
      messages.forEach((entry) => {
        if (prev[entry.id]) next[entry.id] = true;
      });
      return next;
    });
  }, [messages]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleChannelCreated = (channel) => {
      setChannels((prev) => {
        const exists = prev.some((item) => item.id === channel.id);
        return exists ? prev : [...prev, channel];
      });
    };

    const handleChannelInvited = (invite) => {
      setInvites((prev) => [...prev, invite]);
      if (!open) setUnread((count) => count + 1);
    };

    const handleChannelUpdated = (channel) => {
      if (!channel?.id) return;
      setChannels((prev) =>
        prev.map((item) => (item.id === channel.id ? { ...item, ...channel } : item))
      );
      setSelectedChannel((prev) => (prev?.id === channel.id ? { ...prev, ...channel } : prev));
    };

    const handleChannelDeleted = (payload) => {
      const deletedId = payload?.id || payload?.channelId;
      if (!deletedId) return;
      setChannels((prev) => prev.filter((item) => item.id !== deletedId));
      setSelectedChannel((prev) => {
        if (prev?.id !== deletedId) return prev;
        setMessages([]);
        setHasMoreMessages(false);
        return null;
      });
    };

    const handleChannelMessage = (payload) => {
      if (selectedChannel && payload.channelId === selectedChannel.id) {
        addMessageUnique(payload);
      }
      if (!open || !selectedChannel || payload.channelId !== selectedChannel.id) {
        setUnread((count) => count + 1);
      }
    };

    const handleChannelMessageUpdated = (payload) => {
      if (selectedChannel && payload.channelId === selectedChannel.id) {
        upsertMessage(payload);
      }
    };

    const handleChannelMessageDeleted = (payload) => {
      if (selectedChannel && payload.channelId === selectedChannel.id) {
        upsertMessage(payload);
      }
    };

    socket.on('channelCreated', handleChannelCreated);
    socket.on('channelInvited', handleChannelInvited);
    socket.on('channelUpdated', handleChannelUpdated);
    socket.on('channelDeleted', handleChannelDeleted);
    socket.on('channelMemberJoined', () => {});
    socket.on('receiveChannelMessage', handleChannelMessage);
    socket.on('channelMessageUpdated', handleChannelMessageUpdated);
    socket.on('channelMessageDeleted', handleChannelMessageDeleted);

    return () => {
      socket.off('channelCreated', handleChannelCreated);
      socket.off('channelInvited', handleChannelInvited);
      socket.off('channelUpdated', handleChannelUpdated);
      socket.off('channelDeleted', handleChannelDeleted);
      socket.off('receiveChannelMessage', handleChannelMessage);
      socket.off('channelMessageUpdated', handleChannelMessageUpdated);
      socket.off('channelMessageDeleted', handleChannelMessageDeleted);
    };
  }, [socket, open, selectedChannel, addMessageUnique, upsertMessage]);

  const joinChannel = async (channel) => {
    if (!channel || !socket) return;
    setSelectedChannel(channel);
    setMessageLimit(50);
    setActiveMenuMessageId('');
    setActiveMenuChannelId('');
    setEditingMessageId('');
    setEditingMessageText('');
    setActionError('');
    setInviteUserId('');

    const loadHistory = async (limit = 50) => {
      const history = await channelApi.messages(channel.id, limit);
      const normalized = Array.isArray(history) ? history : [];
      setMessages(normalized);
      setHasMoreMessages(normalized.length === limit);
    };

    const joinSocketChannel = () => {
      socket.emit('joinChannel', { channelId: channel.id }, (res) => {
        if (res?.error) {
          setActionError(res.error);
        }
      });
    };

    try {
      await loadHistory(50);

      if (socket.connected) {
        joinSocketChannel();
      } else {
        socket.connect();
        socket.once('connect', joinSocketChannel);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChannel || !socket) return;
    const text = message.trim();
    if (!socket.connected) {
      try {
        const saved = await channelApi.sendMessage(selectedChannel.id, text);
        addMessageUnique(saved);
        setActionError('');
      } catch (err) {
        setActionError(err.message || 'Message could not be sent.');
      }
      setMessage('');
      return;
    }

    socket.emit('sendChannelMessage', { channelId: selectedChannel.id, message: text }, (res) => {
      if (res?.error) {
        channelApi
          .sendMessage(selectedChannel.id, text)
          .then((saved) => {
            addMessageUnique(saved);
            setActionError('');
          })
          .catch((err) => setActionError(err.message || res.error));
        return;
      }
      if (res?.message) {
        addMessageUnique(res.message);
      }
    });
    setMessage('');
  };

  const submitChannel = async () => {
    if (!newChannelName.trim() || !newChannelTeam) {
      setChannelError('Channel name and team are required.');
      return;
    }
    if (!canCreateChannel) {
      setChannelError('Only team leaders can create channels.');
      return;
    }
    setCreating(true);
    try {
      const created = await channelApi.create({ name: newChannelName.trim(), teamId: newChannelTeam });
      setChannels((prev) => (prev.some((item) => item.id === created.id) ? prev : [...prev, created]));
      setNewChannelName('');
      setShowCreateForm(false);
      setChannelError('');
    } catch (err) {
      setChannelError(err.message || 'Channel create failed');
    } finally {
      setCreating(false);
    }
  };

  const acceptInvite = async (invite) => {
    try {
      await channelApi.acceptInvite(invite.channelId);
      setInvites((prev) => prev.filter((item) => item.channelId !== invite.channelId));
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
      setActionError('');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const insertMention = (memberToken) => {
    if (!memberToken) return;
    setMessage((prev) => {
      const atIndex = prev.lastIndexOf('@');
      if (atIndex === -1) return prev;
      return `${prev.slice(0, atIndex)}@${memberToken} `;
    });
  };

  const handleTogglePinMessage = async (entry) => {
    if (!selectedChannel?.id || !entry?.id) return;
    try {
      const shouldUnpin = selectedChannel.pinnedMessageId === entry.id;
      const updatedChannel = shouldUnpin
        ? await channelApi.unpinMessage(selectedChannel.id)
        : await channelApi.pinMessage(selectedChannel.id, entry.id);
      setChannels((prev) =>
        prev.map((item) => (item.id === updatedChannel.id ? { ...item, ...updatedChannel } : item))
      );
      setSelectedChannel((prev) =>
        prev?.id === updatedChannel.id ? { ...prev, ...updatedChannel } : prev
      );
      setActionError('');
    } catch (err) {
      setActionError(err.message || 'Pin action failed.');
    } finally {
      setActiveMenuMessageId('');
    }
  };

  const renderMessageWithMentions = useCallback(
    (text) => {
      const input = String(text || '');
      const parts = [];
      const regex = /@([a-zA-Z0-9_.-]+)/g;
      let last = 0;
      let match = regex.exec(input);

      while (match) {
        const start = match.index;
        const end = regex.lastIndex;
        const token = String(match[1] || '').toLowerCase();

        if (start > last) {
          parts.push(<span key={`txt-${start}`}>{input.slice(last, start)}</span>);
        }

        const isMention = mentionLookup.has(token);
        parts.push(
          <span
            key={`mention-${start}`}
            className={isMention ? 'chat-widget-lite-mention' : undefined}
          >
            {input.slice(start, end)}
          </span>
        );
        last = end;
        match = regex.exec(input);
      }

      if (last < input.length) {
        parts.push(<span key={`txt-end`}>{input.slice(last)}</span>);
      }

      return parts.length ? parts : input;
    },
    [mentionLookup]
  );

  const openEditChannelModal = (channel) => {
    if (!channel?.id) return;
    setChannelModalMode('edit');
    setChannelModalTarget(channel);
    setChannelModalName(channel.name || '');
    setChannelModalError('');
    setActiveMenuChannelId('');
  };

  const openDeleteChannelModal = (channel) => {
    if (!channel?.id) return;
    setChannelModalMode('delete');
    setChannelModalTarget(channel);
    setChannelModalName(channel.name || '');
    setChannelModalError('');
    setActiveMenuChannelId('');
  };

  const closeChannelModal = () => {
    if (channelModalLoading) return;
    setChannelModalMode('');
    setChannelModalTarget(null);
    setChannelModalName('');
    setChannelModalError('');
  };

  const confirmChannelModal = async () => {
    if (!channelModalTarget?.id) return;
    setChannelModalLoading(true);
    setChannelModalError('');

    try {
      if (channelModalMode === 'edit') {
        const trimmed = channelModalName.trim();
        if (!trimmed) {
          setChannelModalError('Channel name is required.');
          setChannelModalLoading(false);
          return;
        }
        const updated = await channelApi.updateChannel(channelModalTarget.id, trimmed);
        setChannels((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
        );
        setSelectedChannel((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
      }

      if (channelModalMode === 'delete') {
        const deleted = await channelApi.deleteChannel(channelModalTarget.id);
        const deletedId = deleted?.id || channelModalTarget.id;
        setChannels((prev) => prev.filter((item) => item.id !== deletedId));
        setSelectedChannel((prev) => {
          if (prev?.id !== deletedId) return prev;
          setMessages([]);
          setHasMoreMessages(false);
          return null;
        });
      }

      setChannelError('');
      setChannelModalLoading(false);
      closeChannelModal();
    } catch (err) {
      setChannelModalLoading(false);
      setChannelModalError(err.message || 'Channel action failed.');
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedChannel) return;
    const nextLimit = messageLimit + 50;
    try {
      const history = await channelApi.messages(selectedChannel.id, nextLimit);
      const normalized = Array.isArray(history) ? history : [];
      setMessages(normalized);
      setMessageLimit(nextLimit);
      setHasMoreMessages(normalized.length === nextLimit);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleStartEdit = (entry) => {
    if (!entry?.id || entry.isDeleted) return;
    setEditingMessageId(entry.id);
    setEditingMessageText(entry.message || '');
    setActiveMenuMessageId('');
    setActionError('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId('');
    setEditingMessageText('');
  };

  const handleSaveEdit = () => {
    if (!selectedChannel || !editingMessageId || !socket) return;
    const nextText = editingMessageText.trim();
    if (!nextText) {
      setActionError('Message cannot be empty.');
      return;
    }

    setSavingMessageId(editingMessageId);
    setActionError('');
    if (socket.connected) {
      socket.emit(
        'updateChannelMessage',
        {
          channelId: selectedChannel.id,
          messageId: editingMessageId,
          message: nextText,
        },
        (res) => {
          setSavingMessageId('');
          if (res?.error) {
            channelApi
              .updateMessage(selectedChannel.id, editingMessageId, nextText)
              .then((updated) => {
                upsertMessage(updated);
                setEditingMessageId('');
                setEditingMessageText('');
              })
              .catch((err) => setActionError(err.message || res.error));
            return;
          }
          if (res?.message) {
            upsertMessage(res.message);
          }
          setEditingMessageId('');
          setEditingMessageText('');
        }
      );
      return;
    }

    channelApi
      .updateMessage(selectedChannel.id, editingMessageId, nextText)
      .then((updated) => {
        setSavingMessageId('');
        upsertMessage(updated);
        setEditingMessageId('');
        setEditingMessageText('');
      })
      .catch((err) => {
        setSavingMessageId('');
        setActionError(err.message || 'Message could not be updated.');
      });
  };

  const handleDeleteMessage = (entry) => {
    if (!selectedChannel || !entry?.id || !socket) return;
    setDeletingMessageId(entry.id);
    setActionError('');
    setActiveMenuMessageId('');
    if (socket.connected) {
      socket.emit(
        'deleteChannelMessage',
        {
          channelId: selectedChannel.id,
          messageId: entry.id,
        },
        (res) => {
          setDeletingMessageId('');
          if (res?.error) {
            channelApi
              .deleteMessage(selectedChannel.id, entry.id)
              .then((deleted) => upsertMessage(deleted))
              .catch((err) => setActionError(err.message || res.error));
            return;
          }
          if (res?.message) {
            upsertMessage(res.message);
          }
          if (editingMessageId === entry.id) {
            setEditingMessageId('');
            setEditingMessageText('');
          }
        }
      );
      return;
    }

    channelApi
      .deleteMessage(selectedChannel.id, entry.id)
      .then((deleted) => {
        setDeletingMessageId('');
        upsertMessage(deleted);
        if (editingMessageId === entry.id) {
          setEditingMessageId('');
          setEditingMessageText('');
        }
      })
      .catch((err) => {
        setDeletingMessageId('');
        setActionError(err.message || 'Message could not be deleted.');
      });
  };

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
          <aside className="chat-widget-lite-left">
            <div className="chat-widget-lite-left-header">
              <div className="chat-widget-lite-title-row">
                <div className="chat-widget-lite-title-text">Channels</div>
                {canCreateAnyChannel && (
                  <button
                    className="chat-widget-lite-add"
                    onClick={() => setShowCreateForm((prev) => !prev)}
                    title="Create channel"
                    aria-label="Create channel"
                  >
                    +
                  </button>
                )}
              </div>
              <input
                className="chat-widget-lite-search"
                placeholder="Search channels"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
              />
              {canCreateAnyChannel && showCreateForm && (
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
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <div className="chat-widget-lite-create-actions">
                    <button
                      className="chat-widget-lite-create-submit"
                      onClick={submitChannel}
                      disabled={creating}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      className="chat-widget-lite-create-cancel"
                      onClick={() => setShowCreateForm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {channelError && <div className="chat-widget-lite-error-text">{channelError}</div>}
            </div>

            <div
              className="chat-widget-lite-channel-list"
              onClick={() => setActiveMenuChannelId('')}
              role="presentation"
            >
              {filteredChannels.length === 0 && (
                <div className="chat-widget-lite-empty-left">No channels found.</div>
              )}
              {filteredChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={`chat-widget-lite-channel-row ${
                    activeMenuChannelId === channel.id ? 'menu-open' : ''
                  }`}
                >
                  <button
                    className={`chat-widget-lite-channel ${
                      selectedChannel?.id === channel.id ? 'active' : ''
                    }`}
                    onClick={() => joinChannel(channel)}
                  >
                    <div className="chat-widget-lite-channel-name"># {channel.name}</div>
                    <div className="chat-widget-lite-channel-meta">
                      {teamNameById.get(channel.teamId) || `Team: ${channel.teamId}`}
                    </div>
                  </button>
                  {canManageChannel(channel) && (
                    <div
                      className="chat-widget-lite-channel-actions"
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <button
                        type="button"
                        className="chat-widget-lite-channel-menu-button"
                        onClick={() =>
                          setActiveMenuChannelId((prev) => (prev === channel.id ? '' : channel.id))
                        }
                        title="Channel actions"
                      >
                        ⋯
                      </button>
                      {activeMenuChannelId === channel.id && (
                        <div className="chat-widget-lite-menu chat-widget-lite-channel-menu">
                          <button onClick={() => openEditChannelModal(channel)}>Edit</button>
                          <button onClick={() => openDeleteChannelModal(channel)}>Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
          </aside>

          <section className="chat-widget-lite-right">
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
                        <option value="">Add user</option>
                        {inviteOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={sendInvite} disabled={!inviteUserId}>
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className="chat-widget-lite-messages"
                  onClick={() => {
                    setActiveMenuMessageId('');
                    setActiveMenuChannelId('');
                  }}
                  role="presentation"
                >
                  {memberError && <div className="chat-widget-lite-error-text">{memberError}</div>}
                  {actionError && <div className="chat-widget-lite-error-text">{actionError}</div>}
                  {hasMoreMessages && (
                    <button className="chat-widget-lite-load-more" onClick={loadMoreMessages}>
                      Load older messages (+50)
                    </button>
                  )}
                  {pinnedMessage && (
                    <div
                      className="chat-widget-lite-pinned-bar"
                      role="button"
                      tabIndex={0}
                      onClick={() => canInvite && handleTogglePinMessage(pinnedMessage)}
                      onKeyDown={(e) => {
                        if (!canInvite) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTogglePinMessage(pinnedMessage);
                        }
                      }}
                      title={canInvite ? 'Click to unpin' : undefined}
                    >
                      <div className="chat-widget-lite-pinned-head">
                        <div className="chat-widget-lite-pinned-label">Pinned message</div>
                        {canInvite && (
                          <span className="chat-widget-lite-pinned-action">Click to unpin</span>
                        )}
                      </div>
                      <div className="chat-widget-lite-pinned-text">
                        {renderMessageWithMentions(
                          pinnedMessage.isDeleted ? DELETED_MESSAGE_TEXT : pinnedMessage.message
                        )}
                      </div>
                    </div>
                  )}
                  {messages.map((entry, messageIndex) => {
                    const isOwn = entry.senderId === currentUserId;
                    const messageTimestamp = entry.createdAt || Date.now();
                    const isDeleted = Boolean(entry.isDeleted) || entry.message === DELETED_MESSAGE_TEXT;
                    const sender = memberById.get(entry.senderId);
                    const senderName = sender?.name || (isOwn ? currentUserName : 'Team member') || 'Team member';
                    const avatarURL = resolveAvatarUrl(
                      sender?.avatarURL || (isOwn ? currentUserAvatarURL : '')
                    );
                    const isEditing = editingMessageId === entry.id;
                    const isSaving = savingMessageId === entry.id;
                    const isDeleting = deletingMessageId === entry.id;
                    const isEdited =
                      !isDeleted &&
                      Number(entry.updatedAt || entry.createdAt) > Number(entry.createdAt || 0);
                    const fullMessageText = isDeleted ? DELETED_MESSAGE_TEXT : entry.message || '';
                    const isExpandable =
                      !isDeleted &&
                      !isEditing &&
                      fullMessageText.length > MESSAGE_PREVIEW_CHAR_LIMIT;
                    const isExpanded = Boolean(expandedMessageIds[entry.id]);
                    const previewMessageText =
                      isExpandable && !isExpanded
                        ? `${fullMessageText.slice(0, MESSAGE_PREVIEW_CHAR_LIMIT).trimEnd()}...`
                        : fullMessageText;
                    const shouldOpenMenuDown = messageIndex < 2;

                    return (
                      <div
                        key={entry.id || entry.createdAt}
                        className={`chat-widget-lite-message-row ${isOwn ? 'own' : 'other'}`}
                      >
                        {!isOwn && (
                          <div className="chat-widget-lite-avatar" title={senderName}>
                            {avatarURL ? (
                              <img src={avatarURL} alt={senderName} />
                            ) : (
                              <span>{getInitials(senderName)}</span>
                            )}
                          </div>
                        )}

                        <div
                          className={`chat-widget-lite-message ${
                            isOwn ? 'chat-widget-lite-message-own' : 'chat-widget-lite-message-other'
                          } ${isDeleted ? 'chat-widget-lite-message-deleted' : ''}`}
                        >
                          <div className="chat-widget-lite-message-head">
                            <span className="chat-widget-lite-sender">{senderName}</span>
                            <div className="chat-widget-lite-message-meta">
                              {isEdited && <span className="chat-widget-lite-edited">edited</span>}
                              <span
                                className="chat-widget-lite-time"
                                title={formatDateDetail(messageTimestamp)}
                              >
                                {formatTime(messageTimestamp)}
                              </span>
                              {(isOwn || canInvite) && !isDeleted && (
                                <div
                                  className={`chat-widget-lite-menu-wrap ${
                                    shouldOpenMenuDown ? 'menu-down' : 'menu-up'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                  role="presentation"
                                >
                                  <button
                                    className="chat-widget-lite-menu-button"
                                    onClick={() =>
                                      setActiveMenuMessageId((prev) =>
                                        prev === entry.id ? '' : entry.id
                                      )
                                    }
                                    title="Message actions"
                                  >
                                    ⋯
                                  </button>
                                  {activeMenuMessageId === entry.id && (
                                    <div className="chat-widget-lite-menu">
                                      {canInvite && !isDeleted && (
                                        <button onClick={() => handleTogglePinMessage(entry)}>
                                          {selectedChannel.pinnedMessageId === entry.id ? 'Unpin' : 'Pin'}
                                        </button>
                                      )}
                                      {isOwn && (
                                        <>
                                          <button onClick={() => handleStartEdit(entry)}>Edit</button>
                                          <button onClick={() => handleDeleteMessage(entry)} disabled={isDeleting}>
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="chat-widget-lite-edit-box">
                              <input
                                value={editingMessageText}
                                onChange={(e) => setEditingMessageText(e.target.value)}
                                maxLength={1000}
                              />
                              <div className="chat-widget-lite-edit-actions">
                                <button onClick={handleSaveEdit} disabled={isSaving}>
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button onClick={handleCancelEdit} type="button">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="chat-widget-lite-message-body">
                                {renderMessageWithMentions(previewMessageText)}
                              </div>
                              {isExpandable && (
                                <button
                                  type="button"
                                  className="chat-widget-lite-show-more"
                                  onClick={() =>
                                    setExpandedMessageIds((prev) => ({
                                      ...prev,
                                      [entry.id]: !prev[entry.id],
                                    }))
                                  }
                                >
                                  {isExpanded ? 'Show less' : '... Show more'}
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {isOwn && (
                          <div className="chat-widget-lite-avatar" title={senderName}>
                            {avatarURL ? (
                              <img src={avatarURL} alt={senderName} />
                            ) : (
                              <span>{getInitials(senderName)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form
                  className="chat-widget-lite-input"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                >
                  <div className="chat-widget-lite-input-wrap">
                    <input
                      placeholder="Type a message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                    />
                    {mentionSuggestions.length > 0 && (
                      <div className="chat-widget-lite-mentions">
                        {mentionSuggestions.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => insertMention(member.token)}
                          >
                            @{member.token} <span>{member.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={!message.trim()}>
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="chat-widget-lite-placeholder">
                Select a channel from the left panel to start messaging.
              </div>
            )}
          </section>

          {channelModalMode && (
            <div className="chat-widget-lite-modal-overlay">
              <div className="chat-widget-lite-modal">
                <div className="chat-widget-lite-modal-title">
                  {channelModalMode === 'edit' ? 'Edit channel' : 'Delete channel'}
                </div>
                {channelModalMode === 'edit' ? (
                  <input
                    className="chat-widget-lite-modal-input"
                    value={channelModalName}
                    onChange={(e) => setChannelModalName(e.target.value)}
                    maxLength={60}
                  />
                ) : (
                  <div className="chat-widget-lite-modal-text">
                    Delete <strong>#{channelModalTarget?.name}</strong> channel?
                  </div>
                )}
                {channelModalError && <div className="chat-widget-lite-error-text">{channelModalError}</div>}
                <div className="chat-widget-lite-modal-actions">
                  <button type="button" onClick={closeChannelModal} disabled={channelModalLoading}>
                    Cancel
                  </button>
                  <button type="button" onClick={confirmChannelModal} disabled={channelModalLoading}>
                    {channelModalLoading ? 'Saving...' : channelModalMode === 'edit' ? 'Save' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ChatWidgetLite;
