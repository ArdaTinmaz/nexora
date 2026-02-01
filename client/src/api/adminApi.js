import { API_BASE_URL } from '../config';

const ADMIN_STORAGE_KEY = 'adminAuthToken';

export const getAdminToken = () => {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch {
    return null;
  }
};

const authHeaders = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, options = {}) => {
  const { skipAuth, ...rest } = options || {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(skipAuth ? {} : authHeaders()),
      ...(rest.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }
  return data;
};

export const adminApi = {
  login: async ({ username, password }) => {
    const res = await request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: {},
      skipAuth: true,
    });
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ token: res.token, username: res.username }));
    return res;
  },
  forgotAdminPassword: (payload) =>
    request('/admin/forgot-password/request', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      skipAuth: true,
    }),
  verifyAdminResetCode: (payload) =>
    request('/admin/forgot-password/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      skipAuth: true,
    }),
  resetAdminPassword: (payload) =>
    request('/admin/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
      skipAuth: true,
    }),
  logout: () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  },
  users: () => request('/admin/users'),
  updateUserMeta: (userId, payload) =>
    request(`/admin/users/${userId}/meta`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  teams: () => request('/admin/teams'),
  createTeam: (payload) =>
    request('/admin/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTeam: (teamId, payload) =>
    request(`/admin/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  addTeamMember: (teamId, payload) =>
    request(`/admin/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeTeamMember: (teamId, userId) =>
    request(`/admin/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }),
  deleteTeam: (teamId) =>
    request(`/admin/teams/${teamId}`, {
      method: 'DELETE',
    }),
  projects: () => request('/admin/projects'),
  createProject: (payload) =>
    request('/admin/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProject: (projectId, payload) =>
    request(`/admin/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateTeamProject: (projectId, teamId) =>
    request(`/admin/projects/${projectId}/teams/${teamId}`, {
      method: 'POST',
    }),
  removeTeamFromProject: (projectId, teamId) =>
    request(`/admin/projects/${projectId}/teams/${teamId}/remove`, {
      method: 'POST',
    }),
  deleteProject: (projectId) =>
    request(`/admin/projects/${projectId}`, {
      method: 'DELETE',
    }),
  adminProfile: () => request('/admin/profile'),
  updateAdminProfile: (payload) =>
    request('/admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createUser: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
