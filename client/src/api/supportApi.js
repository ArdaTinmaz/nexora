import { request } from './httpClient';

const supportApi = {
  sendHelp: ({ email, comment }) =>
    request('/support/help', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, comment }),
      authScope: 'none',
    }),
};

export default supportApi;
