import { API_BASE_URL } from '../config';

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }
  return data;
};

const supportApi = {
  sendHelp: async ({ email, comment }) => {
    const res = await fetch(`${API_BASE_URL}/support/help`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, comment }),
    });
    return handleResponse(res);
  },
};

export default supportApi;
