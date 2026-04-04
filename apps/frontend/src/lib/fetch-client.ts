const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export async function fetchClient<T>(config: {
  url: string;
  method: string;
  params?: Record<string, string>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<T> {
  const { url, method, params, data, headers, signal } = config;

  const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
  const fullUrl = `${BASE_URL}${url}${queryString}`;

  const response = await fetch(fullUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export default fetchClient;
