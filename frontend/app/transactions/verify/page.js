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
  const [risk, setRisk] = useState(null);
  const [requireFallback, setRequireFallback] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    setTransactionId(sessionStorage.getItem('pendingTransactionId') || '');
  }, []);

  async function verify(useFallback = false) {
    setErr('');
    setMsg('');
    setRisk(null);
    setLoading(true);

    try {
      const body = useFallback
        ? { transactionId, passcode }
        : { transactionId, faceImageBase64 };

      const res = await api('/transactions/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      console.log('VERIFY RESPONSE:', res);

      if (res.risk) {
        setRisk(res.risk);
      }

      if (res.requiresExtraVerification === true) {
        setRequireFallback(true);
        setMsg('AI requires additional verification. Please use your fallback passcode.');
        return;
      }

      sessionStorage.removeItem('pendingTransactionId');

      
      if (res.transaction) {
        setReceipt({
          message: res.message,
          transactionId: res.transaction.id,
          recipient: res.transaction.recipient,
          amount: res.transaction.amount,
          status: res.transaction.status,
          method: res.transaction.method,
          confidenceScore: res.transaction.confidenceScore,
          createdAt: res.transaction.createdAt,
        });
      }

      setMsg(`${res.message}. Status: ${res.transaction?.status || 'Success'}`);

    } catch (e) {
      console.error('VERIFY ERROR:', e);

      if (e?.response?.requiresExtraVerification) {
        setRequireFallback(true);
        setRisk(e.response.risk);
        setMsg('AI requires additional verification. Please use your fallback passcode.');
        return;
      }

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
            No pending transaction found.{' '}
            <Link className="font-semibold underline" href="/transactions/create">
              Create one first
            </Link>.
          </p>
        )}

        {msg && (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
            {msg}
          </p>
        )}

        {err && (
          <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {err}
          </p>
        )}

        {/* 🔥 RECEIPT UI */}
        {receipt && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-lg font-bold text-emerald-800">
              Payment Receipt
            </h3>

            <div className="mt-4 space-y-2 text-sm text-emerald-900">
              <p><span className="font-semibold">Status:</span> {receipt.status}</p>
              <p><span className="font-semibold">Recipient:</span> {receipt.recipient}</p>
              <p><span className="font-semibold">Amount:</span> RM {Number(receipt.amount).toFixed(2)}</p>
              <p><span className="font-semibold">Method:</span> {receipt.method}</p>

              {risk && (
  <div className="mt-4 rounded-xl bg-white p-3 text-sm">
    <p className="font-semibold text-slate-700">AI Decision</p>
    <p>Decision: {risk.decision}</p>
    <p>Risk Level: {risk.riskLevel}</p>
    <p className="text-slate-500">{risk.reason}</p>
  </div>
)}
              {receipt.confidenceScore && (
                <p>
                  <span className="font-semibold">Face Confidence:</span>{' '}
                  {Number(receipt.confidenceScore).toFixed(2)}%
                </p>
              )}
              <p className="break-all">
                <span className="font-semibold">Transaction ID:</span>{' '}
                {receipt.transactionId}
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <Link href="/dashboard" className="btn-primary flex-1 text-center">
                Go to Dashboard
              </Link>

              <Link href="/transactions/history" className="btn-soft flex-1 text-center">
                View History
              </Link>
            </div>
          </div>
        )}

        {risk && !receipt && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">AI Risk Decision</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {risk.riskLevel}
              </span>
            </div>

            <p className="mt-3 text-sm">
              <span className="font-medium">Decision:</span> {risk.decision}
            </p>

            <p className="mt-2 text-sm text-slate-600">{risk.reason}</p>
          </div>
        )}

        {/* 🔥 HIDE INPUTS AFTER SUCCESS */}
        {!receipt && !requireFallback && (
          <div className="rounded-3xl border border-slate-200 p-4">
            <h3 className="font-semibold">Face verification</h3>
            <CameraCapture onCapture={setFaceImageBase64} />
            <button
              disabled={loading || !transactionId || !faceImageBase64}
              onClick={() => verify(false)}
              className="btn-primary mt-4 w-full"
            >
              {loading ? 'Verifying...' : 'Authorize with Face2Go'}
            </button>
          </div>
        )}

        {!receipt && requireFallback && (
          <div className="rounded-3xl border border-slate-200 p-4">
            <h3 className="font-semibold">Additional verification required</h3>

            <input
              className="input"
              inputMode="numeric"
              maxLength="6"
              placeholder="6-digit passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
            />

            <button
              disabled={loading || !transactionId || passcode.length !== 6}
              onClick={() => verify(true)}
              className="btn-soft mt-4 w-full"
            >
              {loading ? 'Authorizing...' : 'Authorize with Passcode'}
            </button>

            <button
              type="button"
              onClick={() => setRequireFallback(false)}
              className="mt-3 w-full text-sm font-medium text-slate-500 underline"
            >
              Try face verification again
            </button>
          </div>
        )}
      </section>
    </Shell>
  );
}