'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '../../../components/Shell';
import CameraCapture from '../../../components/CameraCapture';
import { api } from '../../../lib/api';

export default function VerifyTransaction() {
  const [transactionId, setTransactionId] = useState('');
  const [faceImageBase64, setFaceImageBase64] = useState('');
  const [passcode, setPasscode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTransactionId(sessionStorage.getItem('pendingTransactionId') || '');
  }, []);

  async function verify(useFallback = false) {
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const body = useFallback
        ? { transactionId, passcode }
        : { transactionId, faceImageBase64 };
      const res = await api('/transactions/verify', { method: 'POST', body: JSON.stringify(body) });
      sessionStorage.removeItem('pendingTransactionId');
      setMsg(`${res.message}. Status: ${res.transaction.status}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="card mx-auto max-w-2xl space-y-5">
        <h2 className="text-2xl font-bold">Verify Payment</h2>
        {!transactionId && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
            No pending transaction found. <Link className="font-semibold underline" href="/transactions/create">Create one first</Link>.
          </p>
        )}
        {msg && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        <div className="rounded-3xl border border-slate-200 p-4">
          <h3 className="font-semibold">Face verification</h3>
          <p className="mb-4 mt-1 text-sm text-slate-500">Capture a live face image to authorize this payment.</p>
          <CameraCapture onCapture={setFaceImageBase64} label="Capture verification" />
          <button disabled={loading || !transactionId || !faceImageBase64} onClick={() => verify(false)} className="btn-primary mt-4 w-full">
            {loading ? 'Verifying...' : 'Authorize with Face2Go'}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 p-4">
          <h3 className="font-semibold">Fallback passcode</h3>
          <p className="mb-3 mt-1 text-sm text-slate-500">Use this only if camera or face verification is unavailable.</p>
          <input className="input" inputMode="numeric" maxLength="6" placeholder="6-digit passcode" value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))} />
          <button disabled={loading || !transactionId || passcode.length !== 6} onClick={() => verify(true)} className="btn-soft mt-4 w-full">
            Authorize with Passcode
          </button>
        </div>
      </section>
    </Shell>
  );
}
