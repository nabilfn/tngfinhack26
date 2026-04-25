'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '../../../../components/Shell';
import { api } from '../../../../lib/api';

export default function Fallback() {
  const { id } = useParams();
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await api('/transactions/passcode/verify', { method: 'POST', body: JSON.stringify({ transactionId: id, passcode }) });
      router.push(`/transactions/${id}/result`);
    } catch (x) {
      setErr(x.message);
      router.push(`/transactions/${id}/result`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <form onSubmit={submit} className="card mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold">Fallback passcode</h2>
        <p className="text-slate-600">Face confidence was below threshold. Enter your 6-digit fallback passcode.</p>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <input className="input text-center text-2xl tracking-widest" inputMode="numeric" maxLength="6" value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
        <button disabled={loading || passcode.length !== 6} className="btn-primary w-full">{loading ? 'Approving...' : 'Approve payment'}</button>
      </form>
    </Shell>
  );
}
