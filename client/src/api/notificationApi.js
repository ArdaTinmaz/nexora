import { request } from './httpClient';

export const notificationApi = {
  list: (limit = 80) => request(`/notifications?limit=${limit}`),
  markRead: (notificationId) =>
    request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),
  markAllRead: (category = '') =>
    request('/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    }),
  remove: (notificationId) =>
    request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    }),
};
