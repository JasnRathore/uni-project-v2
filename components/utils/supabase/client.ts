class MockAuth {
  async getSession() {
    if (typeof window === 'undefined') return { data: { session: null }, error: null };
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      return { data: { session: { access_token: token, user } }, error: null };
    }
    return { data: { session: null }, error: null };
  }
  
  async signInWithPassword({ email, password }: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { data: { session: { access_token: data.token, user: data.user } }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
  
  async signOut() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return { error: null };
  }
}

export const supabase = {
  auth: new MockAuth()
};
