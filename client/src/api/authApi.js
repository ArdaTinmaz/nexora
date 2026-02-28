import { request } from './httpClient';

export const authApi = {
  login: ({ email, password }) =>
    request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      authScope: 'none',
    }),
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      authScope: 'none',
    }),
  forgotPassword: ({ email }) =>
    request('/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      authScope: 'none',
    }),
  resetPassword: ({ token, password }) =>
    request('/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
      authScope: 'none',
    }),
};
