import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from './socketClient';
import { useLocation, useNavigate } from 'react-router-dom';
import { channelApi } from '../api/channelApi';
import { notificationApi } from '../api/notificationApi';
import { teamApi } from '../api/teamApi';
import userApi from '../api/userApi';
import { getSession } from '../desktop/session';
import { showNotification } from '../desktop/notifications';
import { API_ORIGIN } from '../config';
import './ChatWidgetLite.css';

const DELETED_MESSAGE_TEXT = 'This message was deleted.';
const MESSAGE_PREVIEW_CHAR_LIMIT = 220;
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:\//i;

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

const normalizeAvatarPath = (avatarURL) => {
  if (!avatarURL) return '';

  const trimmed = String(avatarURL).trim();
  if (!trimmed) return '';
  if (/^(?:https?:|data:|blob:|file:)/i.test(trimmed)) return trimmed;

  const normalized = trimmed.replace(/\\/g, '/');
  const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }

  if (WINDOWS_ABSOLUTE_PATH_RE.test(normalized)) {
    const fileName = normalized.split('/').pop();
    return fileName ? `/uploads/${fileName}` : '';
  }

  if (normalized.startsWith('/')) return normalized;
  if (normalized.startsWith('uploads/')) return `/${normalized}`;
  if (!normalized.includes('/')) return `/uploads/${normalized}`;
  return `/${normalized.replace(/^\/+/, '')}`;
};

const resolveAvatarUrl = (avatarURL) => {
  const normalized = normalizeAvatarPath(avatarURL);
  if (!normalized) return '';
  if (/^(?:https?:|data:|blob:|file:)/i.test(normalized)) return normalized;
  return `${API_ORIGIN}${normalized}`;
};

const ChatWidgetLite = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const toggleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pendingChannelId, setPendingChannelId] = useState('');
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
  const [memberModalMode, setMemberModalMode] = useState('');
  const [memberModalUserId, setMemberModalUserId] = useState('');
  const [memberModalLoading, setMemberModalLoading] = useState(false);
  const [memberModalError, setMemberModalError] = useState('');
  const [channelError, setChannelError] = useState('');
  const [actionError, setActionError] = useState('');
  const [channelNotice, setChannelNotice] = useState('');
  const [leavingChannel, setLeavingChannel] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserAvatarURL, setCurrentUserAvatarURL] = useState('');
  const [failedAvatarSources, setFailedAvatarSources] = useState({});
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

  const markAvatarFailed = useCallback((src) => {
    if (!src) return;
    setFailedAvatarSources((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }, []);

  useEffect(() => () => socket.disconnect(), [socket]);

  const loadMessageUnread = useCallback(async () => {
    try {
      const data = await notificationApi.list(1);
      setUnread(
        Number(
          data?.chatUnreadCount ??
            data?.messageUnreadCount ??
            data?.unreadCount ??
            0
        ) || 0
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadMessageUnread();
    const interval = setInterval(loadMessageUnread, 5000);
    return () => clearInterval(interval);
  }, [loadMessageUnread]);

  useEffect(() => {
    let cancelled = false;

    getSession('user')
      .then((session) => {
        if (cancelled) return;
        const sessionUser = session?.user || {};
        if (sessionUser?.id) {
          setCurrentUserId(sessionUser.id);
        }
        if (sessionUser?.name) {
          setCurrentUserName(sessionUser.name);
        }
        if (sessionUser?.avatarURL) {
          setCurrentUserAvatarURL(sessionUser.avatarURL);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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

  const channelMemberIds = useMemo(
    () =>
      new Set(
        (selectedChannel?.members || [])
          .map((member) => String(member?.userId || '').trim())
          .filter(Boolean)
      ),
    [selectedChannel]
  );

  const channelMembers = useMemo(() => {
    if (!selectedChannel) return [];
    if (!channelMemberIds.size) return [];
    return teamMembers.filter((member) => channelMemberIds.has(member.id));
  }, [selectedChannel, channelMemberIds, teamMembers]);

  const isCurrentUserInSelectedChannel = useMemo(
    () => Boolean(selectedChannel && currentUserId && channelMemberIds.has(currentUserId)),
    [selectedChannel, currentUserId, channelMemberIds]
  );

  const removableMembers = useMemo(
    () => channelMembers.filter((member) => member.id !== currentUserId),
    [channelMembers, currentUserId]
  );

  const inviteOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    teamMembers.forEach((member) => {
      if (
        !member?.id ||
        member.id === currentUserId ||
        seen.has(member.id) ||
        channelMemberIds.has(member.id)
      ) {
        return;
      }
      seen.add(member.id);
      list.push({
        id: member.id,
        label: `${member.name} (${member.role})`,
      });
    });
    return list;
  }, [teamMembers, currentUserId, channelMemberIds]);

  const memberModalOptions = useMemo(() => {
    if (memberModalMode === 'add') {
      return inviteOptions.map((option) => ({
        id: option.id,
        label: option.label,
      }));
    }
    if (memberModalMode === 'remove') {
      return removableMembers.map((member) => ({
        id: member.id,
        label: `${member.name} (${member.role || 'member'})`,
      }));
    }
    return [];
  }, [memberModalMode, inviteOptions, removableMembers]);

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
    channelMembers.forEach((member) => {
      const token = tokenizeMentionName(member.name);
      if (!token) return;
      map.set(token.toLowerCase(), member.name);
    });
    return map;
  }, [channelMembers]);
  const mentionMatch = useMemo(() => message.match(/(?:^|\s)@([^\s@]*)$/), [message]);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() || '';
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    return channelMembers
      .filter((member) => member.id !== currentUserId)
      .map((member) => ({
        id: member.id,
        name: member.name,
        token: tokenizeMentionName(member.name),
      }))
      .filter((member) => member.token && member.token.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionMatch, mentionQuery, channelMembers, currentUserId]);
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
    const params = new URLSearchParams(location.search);
    const shouldOpenChat = params.get('chat') === '1';
    if (!shouldOpenChat) return;

    setOpen(true);
    const requestedChannelId = params.get('channelId') || '';
    if (requestedChannelId) {
      setPendingChannelId(requestedChannelId);
    }
  }, [location.search]);

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
    notificationApi.markAllRead('message').catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) return;
    setMemberModalMode('');
    setMemberModalUserId('');
    setMemberModalError('');
    setMemberModalLoading(false);
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
    if (selectedChannel?.id) return;
    setMemberModalMode('');
    setMemberModalUserId('');
    setMemberModalError('');
  }, [selectedChannel?.id]);

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
      if (!invite?.id) return;
      let added = false;
      setInvites((prev) => {
        const exists = prev.some((entry) => entry.id === invite.id);
        if (exists) return prev;
        added = true;
        return [...prev, invite];
      });
      if (!added) return;
      setUnread((count) => count + 1);
      showNotification({
        title: 'Kanal daveti',
        body: `#${invite.channelName || 'kanal'} icin davetiniz var.`,
      }).catch(() => {});
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

    const handleChannelMemberJoined = (payload) => {
      const channelId = payload?.channelId;
      const joinedUserId = payload?.userId;
      if (!channelId || !joinedUserId) return;

      const upsertMember = (members = []) => {
        const exists = members.some((member) => member.userId === joinedUserId);
        if (exists) return members;
        return [...members, { userId: joinedUserId, role: payload?.role || 'member' }];
      };

      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId
            ? { ...channel, members: upsertMember(channel.members || []) }
            : channel
        )
      );
      setSelectedChannel((prev) =>
        prev?.id === channelId ? { ...prev, members: upsertMember(prev.members || []) } : prev
      );
    };

    const handleChannelMemberLeft = (payload) => {
      const channelId = payload?.channelId;
      const leftUserId = payload?.userId;
      if (!channelId || !leftUserId) return;

      const pruneMember = (members = []) =>
        members.filter((member) => String(member?.userId || '') !== String(leftUserId));

      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId ? { ...channel, members: pruneMember(channel.members || []) } : channel
        )
      );
      setSelectedChannel((prev) =>
        prev?.id === channelId ? { ...prev, members: pruneMember(prev.members || []) } : prev
      );
    };

    const handleChannelRemovedForUser = (payload) => {
      const channelId = payload?.channelId;
      if (!channelId) return;
      const messageText = payload?.message || 'You no longer have access to this channel.';

      setChannels((prev) => prev.filter((channel) => channel.id !== channelId));
      setInvites((prev) => prev.filter((invite) => invite.channelId !== channelId));
      setChannelNotice(messageText);
      setActionError(messageText);
      setMessage('');
      setSelectedChannel((prev) =>
        prev?.id === channelId
          ? {
              ...prev,
              members: (prev.members || []).filter(
                (member) => String(member?.userId || '') !== String(currentUserId)
              ),
            }
          : prev
      );
    };

    const handleChannelMessage = (payload) => {
      if (selectedChannel && payload.channelId === selectedChannel.id) {
        addMessageUnique(payload);
      }
      const isOwnMessage = payload?.senderId && payload.senderId === currentUserId;
      if (!isOwnMessage && (!open || !selectedChannel || payload.channelId !== selectedChannel.id)) {
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
    socket.on('channelMemberJoined', handleChannelMemberJoined);
    socket.on('channelMemberLeft', handleChannelMemberLeft);
    socket.on('channelRemovedForUser', handleChannelRemovedForUser);
    socket.on('receiveChannelMessage', handleChannelMessage);
    socket.on('channelMessageUpdated', handleChannelMessageUpdated);
    socket.on('channelMessageDeleted', handleChannelMessageDeleted);

    return () => {
      socket.off('channelCreated', handleChannelCreated);
      socket.off('channelInvited', handleChannelInvited);
      socket.off('channelUpdated', handleChannelUpdated);
      socket.off('channelDeleted', handleChannelDeleted);
      socket.off('channelMemberJoined', handleChannelMemberJoined);
      socket.off('channelMemberLeft', handleChannelMemberLeft);
      socket.off('channelRemovedForUser', handleChannelRemovedForUser);
      socket.off('receiveChannelMessage', handleChannelMessage);
      socket.off('channelMessageUpdated', handleChannelMessageUpdated);
      socket.off('channelMessageDeleted', handleChannelMessageDeleted);
    };
  }, [socket, open, selectedChannel, addMessageUnique, upsertMessage, currentUserId]);

  const joinChannel = useCallback(async (channel) => {
    if (!channel || !socket) return;
    setSelectedChannel(channel);
    setMessageLimit(50);
    setActiveMenuMessageId('');
    setActiveMenuChannelId('');
    setEditingMessageId('');
    setEditingMessageText('');
    setActionError('');
    setChannelNotice('');
    setMemberModalMode('');
    setMemberModalUserId('');
    setMemberModalError('');

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
  }, [socket]);

  useEffect(() => {
    if (!open || !pendingChannelId || channels.length === 0) return;

    const requested = channels.find((channel) => channel.id === pendingChannelId);
    if (!requested) return;

    joinChannel(requested);
    setPendingChannelId('');

    const params = new URLSearchParams(location.search);
    if (params.get('chat') === '1' || params.get('channelId')) {
      params.delete('chat');
      params.delete('channelId');
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
        },
        { replace: true }
      );
    }
  }, [open, pendingChannelId, channels, joinChannel, navigate, location.pathname, location.search]);

  const sendMessage = async () => {
    if (!message.trim() || !selectedChannel || !socket) return;
    if (!isCurrentUserInSelectedChannel) {
      setActionError('You are no longer a member of this channel.');
      return;
    }
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
    if (!invite?.channelId) return;
    try {
      if (socket) {
        if (!socket.connected) {
          socket.connect();
          await new Promise((resolve) => {
            socket.once('connect', resolve);
            setTimeout(resolve, 1000);
          });
        }
        if (socket.connected) {
          await new Promise((resolve, reject) => {
            socket.emit('acceptChannelInvite', { channelId: invite.channelId }, (res) => {
              if (res?.error) {
                reject(new Error(res.error));
                return;
              }
              resolve(res);
            });
          });
        } else {
          await channelApi.acceptInvite(invite.channelId);
        }
      } else {
        await channelApi.acceptInvite(invite.channelId);
      }
      setInvites((prev) => prev.filter((item) => item.id !== invite.id));
      setChannelNotice('');
      const channelList = await channelApi.list();
      setChannels(channelList || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const openMemberModal = (mode) => {
    if (!selectedChannel?.id || !canInvite || !isCurrentUserInSelectedChannel) return;
    const options = mode === 'add' ? inviteOptions : removableMembers;
    setMemberModalMode(mode);
    setMemberModalUserId(options[0]?.id || '');
    setMemberModalError('');
  };

  const closeMemberModal = () => {
    if (memberModalLoading) return;
    setMemberModalMode('');
    setMemberModalUserId('');
    setMemberModalError('');
  };

  const confirmMemberModal = async () => {
    if (!selectedChannel?.id || !memberModalMode || !memberModalUserId || memberModalLoading) return;

    setMemberModalLoading(true);
    setMemberModalError('');
    try {
      if (memberModalMode === 'add') {
        await channelApi.inviteUser(selectedChannel.id, memberModalUserId);
      } else if (memberModalMode === 'remove') {
        setRemovingMember(true);
        await channelApi.removeMember(selectedChannel.id, memberModalUserId);
      }
      setActionError('');
      setMemberModalLoading(false);
      setRemovingMember(false);
      closeMemberModal();
    } catch (err) {
      setMemberModalLoading(false);
      setRemovingMember(false);
      setMemberModalError(err.message || 'Action could not be completed.');
    }
  };

  const leaveCurrentChannel = async () => {
    if (!selectedChannel?.id || leavingChannel || removingMember) return;
    setLeavingChannel(true);
    try {
      await channelApi.leaveChannel(selectedChannel.id);
      setChannels((prev) => prev.filter((channel) => channel.id !== selectedChannel.id));
      setSelectedChannel((prev) =>
        prev?.id === selectedChannel.id
          ? {
              ...prev,
              members: (prev.members || []).filter(
                (member) => String(member?.userId || '') !== String(currentUserId)
              ),
            }
          : prev
      );
      setChannelNotice(`You left #${selectedChannel.name}.`);
      setActionError('');
    } catch (err) {
      setActionError(err.message || 'Could not leave channel.');
    } finally {
      setLeavingChannel(false);
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
        <svg
          className="chat-widget-lite-button-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="M8.5 12h.01" />
          <path d="M12 12h.01" />
          <path d="M15.5 12h.01" />
        </svg>
        {unread > 0 && (
          <span className="chat-widget-lite-badge">{unread > 99 ? '99+' : unread}</span>
        )}
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
                      <span>Channel: {invite.channelName || invite.channelId}</span>
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
                  <div className="chat-widget-lite-chat-header-actions">
                    {canInvite && isCurrentUserInSelectedChannel && (
                      <div className="chat-widget-lite-user-actions">
                        <button
                          type="button"
                          className="chat-widget-lite-user-action-button"
                          title="Add user"
                          aria-label="Add user"
                          onClick={() => openMemberModal('add')}
                          disabled={loadingMembers || inviteOptions.length === 0}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="chat-widget-lite-user-action-button"
                          title="Remove user"
                          aria-label="Remove user"
                          onClick={() => openMemberModal('remove')}
                          disabled={loadingMembers || removableMembers.length === 0 || removingMember || leavingChannel}
                        >
                          -
                        </button>
                      </div>
                    )}
                    {isCurrentUserInSelectedChannel && (
                      <button
                        type="button"
                        className="chat-widget-lite-leave-button"
                        onClick={leaveCurrentChannel}
                        disabled={leavingChannel || removingMember}
                      >
                        {leavingChannel ? 'Leaving...' : 'Leave'}
                      </button>
                    )}
                  </div>
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
                    if (entry?.type === 'system') {
                      const joinedName = entry.joinedUserName || '';
                      const joinedAvatar = resolveAvatarUrl(entry.joinedUserAvatarURL || '');
                      const canRenderJoinedAvatar = Boolean(joinedAvatar && !failedAvatarSources[joinedAvatar]);
                      const systemText = String(entry.message || `${joinedName || 'A teammate'} joined.`);
                      const showSystemAvatar = Boolean(joinedName || joinedAvatar);
                      return (
                        <div key={entry.id || `system-${entry.createdAt}`} className="chat-widget-lite-system-message">
                          {showSystemAvatar && (
                            <span className="chat-widget-lite-system-avatar" title={joinedName}>
                              {canRenderJoinedAvatar ? (
                                <img
                                  src={joinedAvatar}
                                  alt={joinedName}
                                  onError={() => markAvatarFailed(joinedAvatar)}
                                />
                              ) : (
                                <span>{getInitials(joinedName)}</span>
                              )}
                            </span>
                          )}
                          <span className="chat-widget-lite-system-text">
                            {systemText}
                          </span>
                        </div>
                      );
                    }

                    const isOwn = entry.senderId === currentUserId;
                    const messageTimestamp = entry.createdAt || Date.now();
                    const isDeleted = Boolean(entry.isDeleted) || entry.message === DELETED_MESSAGE_TEXT;
                    const sender = memberById.get(entry.senderId);
                    const senderName = sender?.name || (isOwn ? currentUserName : 'Team member') || 'Team member';
                    const avatarURL = resolveAvatarUrl(
                      sender?.avatarURL || (isOwn ? currentUserAvatarURL : '')
                    );
                    const canRenderAvatar = Boolean(avatarURL && !failedAvatarSources[avatarURL]);
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
                            {canRenderAvatar ? (
                              <img
                                src={avatarURL}
                                alt={senderName}
                                onError={() => markAvatarFailed(avatarURL)}
                              />
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
                            {canRenderAvatar ? (
                              <img
                                src={avatarURL}
                                alt={senderName}
                                onError={() => markAvatarFailed(avatarURL)}
                              />
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
                      placeholder={
                        isCurrentUserInSelectedChannel
                          ? 'Type a message...'
                          : 'You are no longer a member of this channel.'
                      }
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      disabled={!isCurrentUserInSelectedChannel}
                    />
                    {isCurrentUserInSelectedChannel && mentionSuggestions.length > 0 && (
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
                  <button type="submit" disabled={!message.trim() || !isCurrentUserInSelectedChannel}>
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="chat-widget-lite-placeholder">
                {channelNotice && <div className="chat-widget-lite-placeholder-notice">{channelNotice}</div>}
                Select a channel from the left panel to start messaging.
              </div>
            )}
          </section>

          {memberModalMode && (
            <div className="chat-widget-lite-modal-overlay">
              <div className="chat-widget-lite-modal chat-widget-lite-member-modal">
                <div className="chat-widget-lite-modal-title">
                  {memberModalMode === 'add' ? 'Add user' : 'Remove user'}
                </div>
                <div className="chat-widget-lite-modal-text">
                  {memberModalMode === 'add'
                    ? `Select a user to add to #${selectedChannel?.name || ''}.`
                    : `Select a user to remove from #${selectedChannel?.name || ''}.`}
                </div>
                {loadingMembers ? (
                  <div className="chat-widget-lite-modal-empty">Loading users...</div>
                ) : memberModalOptions.length === 0 ? (
                  <div className="chat-widget-lite-modal-empty">
                    {memberModalMode === 'add'
                      ? 'No available user to add.'
                      : 'No removable user in this channel.'}
                  </div>
                ) : (
                  <div className="chat-widget-lite-modal-option-list">
                    {memberModalOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`chat-widget-lite-modal-option ${
                          memberModalUserId === option.id ? 'active' : ''
                        }`}
                        onClick={() => setMemberModalUserId(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {memberModalError && <div className="chat-widget-lite-error-text">{memberModalError}</div>}
                <div className="chat-widget-lite-modal-actions">
                  <button type="button" onClick={closeMemberModal} disabled={memberModalLoading}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmMemberModal}
                    disabled={
                      memberModalLoading ||
                      loadingMembers ||
                      !memberModalUserId ||
                      memberModalOptions.length === 0
                    }
                  >
                    {memberModalLoading
                      ? memberModalMode === 'add'
                        ? 'Adding...'
                        : 'Removing...'
                      : memberModalMode === 'add'
                        ? 'Add'
                        : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
