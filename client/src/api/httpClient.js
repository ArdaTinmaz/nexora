import { getDesktopBridge, isDesktopApp } from '../desktop/bridge';
import { runtime } from '../desktop/runtime';

const handleResponsePayload = (payload) => {
  const data = payload?.data ?? {};

  if (!payload?.ok) {
    const message = data?.message || 'Request failed';
    throw new Error(message);
  }

  return data;
};

const ensureJsonHeaders = (headers, body) => {
  const resolvedHeaders = { ...headers };
  const hasContentType =
    typeof resolvedHeaders['Content-Type'] !== 'undefined' ||
    typeof resolvedHeaders['content-type'] !== 'undefined';

  if (typeof body === 'string' && !hasContentType) {
    resolvedHeaders['Content-Type'] = 'application/json';
  }

  return resolvedHeaders;
};

const serializeFormData = async (body) => {
  const entries = [];
  const canReadBrowserFile = typeof File !== 'undefined';

  for (const [name, value] of body.entries()) {
    if (canReadBrowserFile && value instanceof File) {
      entries.push({
        kind: 'file',
        name,
        fileName: value.name,
        mimeType: value.type,
        buffer: await value.arrayBuffer(),
      });
      continue;
    }

    if (value?.kind === 'desktop-file' && value.buffer) {
      entries.push({
        kind: 'file',
        name,
        fileName: value.name,
        mimeType: value.mimeType,
        buffer: value.buffer,
      });
      continue;
    }

    entries.push({
      kind: 'text',
      name,
      value,
    });
  }

  return {
    kind: 'form-data',
    entries,
  };
};

const serializeBody = async (body) => {
  if (!body) {
    return undefined;
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return serializeFormData(body);
  }

  return {
    kind: 'raw',
    value: body,
  };
};

const buildWebHeaders = (headers) => ({ ...headers });

export const request = async (path, options = {}) => {
  const {
    authScope = 'user',
    headers = {},
    body,
    ...rest
  } = options;
  const resolvedHeaders = ensureJsonHeaders(headers, body);

  if (isDesktopApp()) {
    const payload = await getDesktopBridge().api.request({
      path,
      method: rest.method || 'GET',
      headers: resolvedHeaders,
      body: await serializeBody(body),
      authScope,
    });
    return handleResponsePayload(payload);
  }

  const webHeaders = buildWebHeaders(resolvedHeaders);
  const response = await fetch(`${runtime.apiBaseUrl}${path}`, {
    ...rest,
    headers: webHeaders,
    body,
    credentials: 'include',
  });

  return handleResponsePayload({
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => ({})),
  });
};
