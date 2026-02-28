import { request } from './httpClient';

const userApi = {
  getProfile: () => request('/users/me'),
  updateProfile: ({ name, password, avatarURL }) =>
    request('/users/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(name ? { name } : {}),
        ...(password ? { password } : {}),
        ...(typeof avatarURL === 'string' ? { avatarURL } : {}),
      }),
    }),
  requestEmailChange: ({ newEmail }) =>
    request('/users/me/email/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newEmail }),
    }),
  verifyEmailChange: ({ code }) =>
    request('/users/me/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    }),
};

export default userApi;
