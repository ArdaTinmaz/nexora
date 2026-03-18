const RECENT_HOME_ITEMS_KEY = 'nexoraRecentHomeItems';
const MAX_RECENT_ITEMS = 12;

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const normalizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const type = entry.type === 'company' ? 'company' : entry.type === 'board' ? 'board' : null;
  const id = String(entry.id || '').trim();
  const path = String(entry.path || '').trim();
  const label = String(entry.label || '').trim();
  const visitedAt = Number(entry.visitedAt || Date.now());

  if (!type || !id || !path) return null;

  return {
    type,
    id,
    path,
    label,
    visitedAt: Number.isFinite(visitedAt) ? visitedAt : Date.now(),
  };
};

export const readRecentHomeItems = () => {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(RECENT_HOME_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, MAX_RECENT_ITEMS);
  } catch (_) {
    return [];
  }
};

export const pushRecentHomeItem = (entry) => {
  const normalized = normalizeEntry(entry);
  if (!normalized || !isBrowser()) return [];

  const current = readRecentHomeItems();
  const next = [
    { ...normalized, visitedAt: Date.now() },
    ...current.filter((item) => !(item.type === normalized.type && item.id === normalized.id)),
  ].slice(0, MAX_RECENT_ITEMS);

  try {
    window.localStorage.setItem(RECENT_HOME_ITEMS_KEY, JSON.stringify(next));
  } catch (_) {
    return current;
  }

  return next;
};
