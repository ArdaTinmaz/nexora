import { getSessionSync, setSession, clearSession } from '../desktop/session';
import { request } from './httpClient';

export const getAdminToken = () => getSessionSync('admin')?.token || null;

export const adminApi = {
  login: async ({ username, password }) => {
    const res = await request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: {},
      authScope: 'none',
    });
    await setSession('admin', { token: res.token, username: res.username });
    return res;
  },
  forgotAdminPassword: (payload) =>
    request('/admin/forgot-password/request', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      authScope: 'none',
    }),
  verifyAdminResetCode: (payload) =>
    request('/admin/forgot-password/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      authScope: 'none',
    }),
  resetAdminPassword: (payload) =>
    request('/admin/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      authScope: 'none',
    }),
  logout: () => clearSession('admin'),
  users: () => request('/admin/users', { authScope: 'admin' }),
  updateUserMeta: (userId, payload) =>
    request(`/admin/users/${userId}/meta`, {
      method: 'POST',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  teams: () => request('/admin/teams', { authScope: 'admin' }),
  createTeam: (payload) =>
    request('/admin/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  updateTeam: (teamId, payload) =>
    request(`/admin/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  addTeamMember: (teamId, payload) =>
    request(`/admin/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  removeTeamMember: (teamId, userId) =>
    request(`/admin/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      authScope: 'admin',
    }),
  deleteTeam: (teamId) =>
    request(`/admin/teams/${teamId}`, {
      method: 'DELETE',
      authScope: 'admin',
    }),
  projects: () => request('/admin/projects', { authScope: 'admin' }),
  createProject: (payload) =>
    request('/admin/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  updateProject: (projectId, payload) =>
    request(`/admin/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  updateTeamProject: (projectId, teamId) =>
    request(`/admin/projects/${projectId}/teams/${teamId}`, {
      method: 'POST',
      authScope: 'admin',
    }),
  removeTeamFromProject: (projectId, teamId) =>
    request(`/admin/projects/${projectId}/teams/${teamId}/remove`, {
      method: 'POST',
      authScope: 'admin',
    }),
  deleteProject: (projectId) =>
    request(`/admin/projects/${projectId}`, {
      method: 'DELETE',
      authScope: 'admin',
    }),
  adminProfile: () => request('/admin/profile', { authScope: 'admin' }),
  updateAdminProfile: (payload) =>
    request('/admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
  createUser: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      authScope: 'admin',
    }),
};
