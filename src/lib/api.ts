export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
let refreshing: Promise<Response> | null = null;
export async function api<T>(path: string, body?: unknown, retry = true): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (response.status === 401 && retry && !path.startsWith('/api/auth')) {
    refreshing ??= fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).finally(() => {
      refreshing = null;
    });
    const refreshed = await refreshing;
    if (refreshed.ok) return api<T>(path, body, false);
  }
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error?.message || 'Unable to complete this request.',
      response.status,
      data.error?.code || 'UNKNOWN',
    );
  return data as T;
}
