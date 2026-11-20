type AuthUser = {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
};

type AuthSession = {
  access_token: string;
  expires_at: number;
  user: AuthUser;
};

type SessionResult = { data: { session: AuthSession | null }; error: Error | null };
type SignInResult = { data: { session: AuthSession | null; user: AuthUser | null }; error: Error | null };
type UpdateResult = { data: Record<string, unknown> | null; error: Error | null };

const REFRESH_SKEW_MS = 60_000;

// The access token lives only in memory; the durable credential is the
// HttpOnly refresh cookie the server sets. Nothing is persisted to
// localStorage, so a stolen XSS payload cannot exfiltrate the session.
let currentSession: AuthSession | null = null;
let inflightRefresh: Promise<AuthSession | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const toSession = (payload: any): AuthSession | null => {
  if (!payload?.token || !payload?.user) return null;
  const seconds = Number(payload.expiresIn) || 900;
  return { access_token: payload.token, expires_at: Date.now() + seconds * 1000, user: payload.user as AuthUser };
};

const scheduleRefresh = () => {
  if (typeof window === 'undefined') return;
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!currentSession) return;
  const delay = Math.max(5_000, currentSession.expires_at - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(() => {
    void refreshSession().then(scheduleRefresh);
  }, delay);
};

const setSession = (next: AuthSession | null) => {
  currentSession = next;
  if (next) scheduleRefresh();
  else if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

// Single-flight: every caller shares one in-progress rotation so concurrent
// widgets cannot replay the refresh token and trip reuse detection.
const refreshSession = async (): Promise<AuthSession | null> => {
  if (typeof window === 'undefined') return null;
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = await res.json();
        return toSession(data);
      } catch {
        return null;
      }
    })().finally(() => {
      inflightRefresh = null;
    });
  }
  const next = await inflightRefresh;
  if (!next) setSession(null);
  else setSession(next);
  return next;
};

class MockAuth {
  async getSession(): Promise<SessionResult> {
    if (typeof window === 'undefined') return { data: { session: null }, error: null };
    if (currentSession && currentSession.expires_at - REFRESH_SKEW_MS > Date.now()) {
      scheduleRefresh();
      return { data: { session: currentSession }, error: null };
    }
    const refreshed = await refreshSession();
    return { data: { session: refreshed }, error: null };
  }

  async refreshSession(): Promise<SessionResult> {
    const refreshed = await refreshSession();
    return { data: { session: refreshed }, error: null };
  }

  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<SignInResult> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Login failed');
      const session = toSession(data);
      setSession(session);
      return { data: { session, user: session?.user ?? null }, error: null };
    } catch (err) {
      setSession(null);
      return { data: { session: null, user: null }, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Clearing local state below is enough; the cookie expires server-side.
    }
    setSession(null);
    return { error: null };
  }

  async updateUser({ password, currentPassword }: { password: string; currentPassword?: string }): Promise<UpdateResult> {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(currentSession ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
        },
        body: JSON.stringify({ password, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export const supabase = {
  auth: new MockAuth()
};
