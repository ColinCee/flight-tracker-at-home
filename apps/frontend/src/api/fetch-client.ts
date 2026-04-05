const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchClient<T>(url: string, config: RequestInit = {}): Promise<T> {
  const fullUrl = `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Orval expects { data, status, headers } shape from the fetch client
  return { data, status: response.status, headers: response.headers } as T;
}
