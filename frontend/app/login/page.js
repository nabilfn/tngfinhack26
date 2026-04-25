'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '../../components/Shell';
import { api } from '../../lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('token', d.token);
      router.push('/dashboard');
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <form onSubmit={submit} className="card mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Login</h2>
        <p className="text-sm text-slate-500">Use an account from the database. Seed demo accounts are optional.</p>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button>
        <p className="text-center text-sm text-slate-500">
          No account? <Link className="font-semibold text-slate-900" href="/signup">Create one</Link>
        </p>
      </form>
    </Shell>
  );
}
