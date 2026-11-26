import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../../../packages/shared/types';
export async function api<T = any>(url: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch('/api' + url, {
    credentials: 'include',
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Request failed.');
  return data;
}
const Auth = createContext<{ user: User | null; refresh: () => Promise<void>; loading: boolean }>({
  user: null,
  refresh: async () => {},
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  async function refresh() {
    try {
      const next = (await api('/auth/me')).user as User | null;
      setUser(next);
      if (next?.settings) {
        localStorage.setItem('cm-board', next.settings.board);
        localStorage.setItem('cm-muted', String(next.settings.muted));
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh().catch(() => {});
  }, []);
  return <Auth.Provider value={{ user, refresh, loading }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
export function useResource<T>(url: string) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setData(undefined);
    setError('');
    api<T>(url)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [url]);
  return { data, error, setData };
}
export function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
