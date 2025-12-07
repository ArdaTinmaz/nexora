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
  const data = await response
    .json()
    .catch(() => ({}));

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

export const boardApi = {
  getBoards: () => request('/boards'),

  getBoard: (boardId) => request(`/boards/${boardId}`),

  createBoard: (boardData) =>
    request('/boards', {
      method: 'POST',
      body: JSON.stringify(boardData),
    }),

  updateBoard: (boardId, boardData) =>
    request(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(boardData),
    }),

  deleteBoard: (boardId) =>
    request(`/boards/${boardId}`, {
      method: 'DELETE',
    }),

  updateBoardBackground: (boardId, background) =>
    request(`/boards/${boardId}/background`, {
      method: 'PATCH',
      body: JSON.stringify({ background }),
    }),

  createColumn: (boardId, columnData) =>
    request(`/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify(columnData),
    }),

  updateColumn: (boardId, columnId, columnData) =>
    request(`/boards/${boardId}/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(columnData),
    }),

  deleteColumn: (boardId, columnId) =>
    request(`/boards/${boardId}/columns/${columnId}`, {
      method: 'DELETE',
    }),

  createCard: (boardId, columnId, cardData) =>
    request(`/boards/${boardId}/columns/${columnId}/cards`, {
      method: 'POST',
      body: JSON.stringify(cardData),
    }),

  updateCard: (boardId, columnId, cardId, cardData) =>
    request(`/boards/${boardId}/columns/${columnId}/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(cardData),
    }),

  deleteCard: (boardId, columnId, cardId) =>
    request(`/boards/${boardId}/columns/${columnId}/cards/${cardId}`, {
      method: 'DELETE',
    }),

  moveCard: (boardId, fromColumnId, toColumnId, cardId) =>
    request(`/boards/${boardId}/cards/move`, {
      method: 'PATCH',
      body: JSON.stringify({
        fromColumnId,
        toColumnId,
        cardId,
      }),
    }),
};
