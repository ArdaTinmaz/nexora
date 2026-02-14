import { API_BASE_URL, AUTH_STORAGE_KEY } from '../config';

const authHeaders = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed?.token ? { Authorization: `Bearer ${parsed.token}` } : {};
  } catch {
    return {};
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }
  return data;
};

export const channelApi = {
  list: () => request('/channels'),
  create: ({ name, teamId }) =>
    request('/channels', {
      method: 'POST',
      body: JSON.stringify({ name, teamId }),
    }),
  updateChannel: (channelId, name) =>
    request(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteChannel: (channelId) =>
    request(`/channels/${channelId}`, {
      method: 'DELETE',
    }),
  pinMessage: (channelId, messageId) =>
    request(`/channels/${channelId}/pin/${messageId}`, {
      method: 'POST',
    }),
  unpinMessage: (channelId) =>
    request(`/channels/${channelId}/pin`, {
      method: 'DELETE',
    }),
  messages: (channelId, limit = 50) => request(`/channels/${channelId}/messages?limit=${limit}`),
  sendMessage: (channelId, message) =>
    request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  updateMessage: (channelId, messageId, message) =>
    request(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    }),
  deleteMessage: (channelId, messageId) =>
    request(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    }),
  invites: () => request('/channels/invites'),
  inviteUser: (channelId, userId) =>
    request(`/channels/${channelId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  acceptInvite: (channelId) =>
    request(`/channels/${channelId}/accept`, {
      method: 'POST',
    }),
};
