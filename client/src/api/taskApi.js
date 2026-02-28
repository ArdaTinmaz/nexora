import { request } from './httpClient';

export const taskApi = {
  listAssigned: () => request('/tasks/assigned'),
  create: (payload) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (assignmentId, payload) =>
    request(`/tasks/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (assignmentId) =>
    request(`/tasks/${assignmentId}`, {
      method: 'DELETE',
    }),
  transfer: (assignmentId, columnId) =>
    request(`/tasks/${assignmentId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ columnId }),
    }),
  updateStatus: (assignmentId, status) =>
    request(`/tasks/${assignmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
