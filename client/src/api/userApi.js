import { API_BASE_URL, AUTH_STORAGE_KEY } from '../config';

const getAuthHeaders = () => {
  try {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedAuth) return {};
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

const userApi = {
  getProfile: async () => {
    const res = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    return handleResponse(res);
  },
  updateProfile: async ({ name, password, avatar }) => {
    const formData = new FormData();
    if (name) formData.append('name', name);
    if (password) formData.append('password', password);
    if (avatar) formData.append('avatar', avatar);

    const res = await fetch(`${API_BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    return handleResponse(res);
  },
  requestEmailChange: async ({ newEmail }) => {
    const res = await fetch(`${API_BASE_URL}/users/me/email/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ newEmail }),
    });
    return handleResponse(res);
  },
  verifyEmailChange: async ({ code }) => {
    const res = await fetch(`${API_BASE_URL}/users/me/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ code }),
    });
    return handleResponse(res);
  },
};

export default userApi;
