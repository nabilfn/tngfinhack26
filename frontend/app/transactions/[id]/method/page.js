'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '../../../../components/Shell';
import { api } from '../../../../lib/api';

export default function Method() {
  const { id } = useParams();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState('');

  async function payTng() {
    setErr('');
    setLoading('tng');
    try {
      await api('/transactions/pay/tng', { method: 'POST', body: JSON.stringify({ transactionId: id }) });
      router.push(`/transactions/${id}/result`);
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading('');
    }
  }

  return (
    <Shell>
      <div className="card mx-auto max-w-xl">
        <h2 className="text-2xl font-bold">Choose payment method</h2>
        <p className="mt-2 text-sm text-slate-500">Payment approval is processed by the backend only.</p>
        {err && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="mt-6 grid gap-3">
          <button disabled={Boolean(loading)} onClick={payTng} className="btn-soft text-left">
            Touch ’n Go Wallet<br />
            <span className="text-sm font-normal text-slate-500">Normal wallet approval</span>
          </button>
          <button disabled={Boolean(loading)} onClick={() => router.push(`/transactions/${id}/verify`)} className="btn-primary text-left">
            Face2Go Biometric Payment<br />
            <span className="text-sm font-normal text-slate-300">Live camera verification with passcode fallback</span>
          </button>
        </div>
      </div>
    </Shell>
  );
}
