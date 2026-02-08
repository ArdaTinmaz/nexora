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

export const companyBoardApi = {
  getBoard: (projectId) => request(`/projects/${projectId}/board`),
  updateBoard: (projectId, boardData) =>
    request(`/projects/${projectId}/board`, {
      method: 'PATCH',
      body: JSON.stringify(boardData),
    }),

  createColumn: (projectId, columnData) =>
    request(`/projects/${projectId}/board/columns`, {
      method: 'POST',
      body: JSON.stringify(columnData),
    }),

  updateColumn: (projectId, columnId, columnData) =>
    request(`/projects/${projectId}/board/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(columnData),
    }),

  reorderColumns: (projectId, columnIds) =>
    request(`/projects/${projectId}/board/columns/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ columnIds }),
    }),

  deleteColumn: (projectId, columnId) =>
    request(`/projects/${projectId}/board/columns/${columnId}`, {
      method: 'DELETE',
    }),

  createCard: (projectId, columnId, cardData) =>
    request(`/projects/${projectId}/board/columns/${columnId}/cards`, {
      method: 'POST',
      body: JSON.stringify(cardData),
    }),

  updateCard: (projectId, columnId, cardId, cardData) =>
    request(`/projects/${projectId}/board/columns/${columnId}/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(cardData),
    }),

  setCardCompletion: (projectId, columnId, cardId, completed) =>
    request(`/projects/${projectId}/board/columns/${columnId}/cards/${cardId}/completion`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  setCardOwnership: (projectId, columnId, cardId, action) =>
    request(`/projects/${projectId}/board/columns/${columnId}/cards/${cardId}/claim`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),

  deleteCard: (projectId, columnId, cardId) =>
    request(`/projects/${projectId}/board/columns/${columnId}/cards/${cardId}`, {
      method: 'DELETE',
    }),

  moveCard: (projectId, fromColumnId, toColumnId, cardId, toIndex) =>
    request(`/projects/${projectId}/board/cards/move`, {
      method: 'PATCH',
      body: JSON.stringify({ fromColumnId, toColumnId, cardId, toIndex }),
    }),
};
