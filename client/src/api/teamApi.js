import { request } from './httpClient';

export const teamApi = {
  myTeams: () => request('/teams/my'),
  members: (teamId) => request(`/teams/${teamId}/members`),
};
