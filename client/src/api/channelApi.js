import { request } from './httpClient';

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
  leaveChannel: (channelId) =>
    request(`/channels/${channelId}/leave`, {
      method: 'POST',
    }),
  removeMember: (channelId, userId) =>
    request(`/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
    }),
};
