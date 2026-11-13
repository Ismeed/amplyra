export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

const ACCESS_TOKEN_KEY = 'amplyra_access_token';
const REFRESH_TOKEN_KEY = 'amplyra_refresh_token';

export function getStoredTokens() {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearStoredTokens();
    return null;
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  setStoredTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const { accessToken } = getStoredTokens();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const newAccessToken = await tryRefreshToken();
    if (newAccessToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      if (Array.isArray(errBody?.message)) {
        message = errBody.message.join(', ');
      } else if (errBody?.message) {
        message = errBody.message;
      }
    } catch {
      // ignore non-json error response
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
