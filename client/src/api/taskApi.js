import { API_BASE_URL, AUTH_STORAGE_KEY } from '../config';

const getAuthHeaders = () => {
  try {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedAuth) {
      return {};
    }
    const parsed = JSON.parse(storedAuth);
    return parsed?.token ? { Authorization: `Bearer ${parsed.token}` } : {};
  } catch {
    return {};
  }
};

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }
  return data;
};

const request = async (endpoint, options = {}) => {
  const { headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...headers,
    },
  });
  return handleResponse(response);
};

export const taskApi = {
  listAssigned: () => request('/tasks/assigned'),
  create: (payload) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
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
