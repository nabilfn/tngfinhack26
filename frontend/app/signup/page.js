'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../components/Shell';
import CameraCapture from '../../components/CameraCapture';
import { api } from '../../lib/api';

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', passcode: '', initialWalletBalance: '' });
  const [faceImageBase64, setFaceImageBase64] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        initialWalletBalance: Number(form.initialWalletBalance || 0),
        ...(faceImageBase64 ? { faceImageBase64 } : {}),
      };
      const d = await api('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
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
      <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Create Face2Go account</h2>
          <p className="mt-1 text-sm text-slate-500">Face enrollment is optional, but required for biometric payment.</p>
        </div>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" required placeholder="Full name" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <input className="input" required placeholder="Email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <input className="input" required type="password" placeholder="Password, min 8 chars" value={form.password} onChange={(e) => update('password', e.target.value)} />
          <input className="input" required inputMode="numeric" maxLength="6" placeholder="6-digit fallback passcode" value={form.passcode} onChange={(e) => update('passcode', e.target.value.replace(/\D/g, ''))} />
          <input className="input sm:col-span-2" required type="number" min="0" step="0.01" placeholder="Initial wallet balance" value={form.initialWalletBalance} onChange={(e) => update('initialWalletBalance', e.target.value)} />
        </div>
        <div className="rounded-3xl border border-slate-200 p-4">
          <h3 className="font-semibold">Face enrollment</h3>
          <p className="mb-4 mt-1 text-sm text-slate-500">Capture a clear front-facing face image or upload one.</p>
          <CameraCapture onCapture={setFaceImageBase64} label="Capture enrollment" />
        </div>
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating account...' : 'Sign up'}</button>
      </form>
    </Shell>
  );
}
