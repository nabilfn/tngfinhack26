const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function token() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

export function logout() {
  if (typeof window !== 'undefined') localStorage.removeItem('token');
}

export async function api(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...(opts.headers || {}),
  };

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
