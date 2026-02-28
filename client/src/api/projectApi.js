import { request } from './httpClient';

export const projectApi = {
  list: () => request('/projects'),
  listAssigned: () => request('/projects/assigned'),
  create: ({ name, parentProjectId }) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, parentProjectId }),
    }),
  listTeams: (projectId) => request(`/projects/${projectId}/teams`),
  createTeam: (projectId, { name, leaderId, members }) =>
    request(`/projects/${projectId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name, leaderId, members }),
    }),
  addMember: (projectId, teamId, { userId, role }) =>
    request(`/projects/${projectId}/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),
};
