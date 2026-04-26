'use client';

import { useState } from 'react';
import Link from 'next/link';
import Shell from '../../../components/Shell';
import CameraCapture from '../../../components/CameraCapture';
import { api } from '../../../lib/api';

export default function CreateTransaction() {
  const [amount, setAmount] = useState('');
  const [faceImageBase64, setFaceImageBase64] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [risk, setRisk] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setRisk(null);
    setReceipt(null);
    setLoading(true);

    try {
      const res = await api('/transactions/face-pay', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), faceImageBase64 }),
      });

      setRisk(res.risk || null);
      setReceipt({
        message: res.message,
        payerName: res.transaction?.payerName || res.payerIdentified?.name,
        payerEmail: res.transaction?.payerEmail || res.payerIdentified?.email,
        receiverName: res.transaction?.receiverName,
        receiverEmail: res.transaction?.receiverEmail,
        amount: res.transaction?.amount,
        status: res.transaction?.status,
        method: res.transaction?.method,
        confidenceScore: res.transaction?.confidenceScore,
        transactionId: res.transaction?.id,
        createdAt: res.transaction?.createdAt,
      });
      setMsg('Payment completed successfully.');
      setAmount('');
      setFaceImageBase64('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="card mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Face Payment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Receiver/payee stays logged in. The payer does not log in; scan the payer&apos;s enrolled face to identify them and complete payment.
          </p>
        </div>

        {msg && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        {receipt && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-lg font-bold text-emerald-800">Payment Receipt</h3>
            <div className="mt-4 space-y-2 text-sm text-emerald-900">
              <p><span className="font-semibold">Status:</span> {receipt.status}</p>
              <p><span className="font-semibold">Payer identified:</span> {receipt.payerName} ({receipt.payerEmail})</p>
              <p><span className="font-semibold">Receiver:</span> {receipt.receiverName} ({receipt.receiverEmail})</p>
              <p><span className="font-semibold">Amount:</span> RM {Number(receipt.amount).toFixed(2)}</p>
              <p><span className="font-semibold">Method:</span> {receipt.method}</p>
              {receipt.confidenceScore && (
                <p><span className="font-semibold">Face Confidence:</span> {Number(receipt.confidenceScore).toFixed(2)}%</p>
              )}
              <p className="break-all"><span className="font-semibold">Transaction ID:</span> {receipt.transactionId}</p>
            </div>

            {risk && (
              <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-700">
                <p className="font-semibold">AI Risk Decision</p>
                <p>Decision: {risk.decision}</p>
                <p>Risk Level: {risk.riskLevel}</p>
                <p className="text-slate-500">{risk.reason}</p>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <Link href="/dashboard" className="btn-primary flex-1 text-center">Go to Dashboard</Link>
              <Link href="/transactions/history" className="btn-soft flex-1 text-center">View History</Link>
            </div>
          </div>
        )}

        {!receipt && (
          <form onSubmit={submit} className="space-y-5">
            <input
              className="input"
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Amount, e.g. 12.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <div className="rounded-3xl border border-slate-200 p-4">
              <h3 className="font-semibold">Scan payer face</h3>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Ask the payer to look at the receiver&apos;s camera. Their account must already have face enrollment.
              </p>
              <CameraCapture onCapture={setFaceImageBase64} label="Capture payer face" />
            </div>

            <button disabled={loading || !amount || !faceImageBase64} className="btn-primary w-full">
              {loading ? 'Processing face payment...' : 'Scan Face & Complete Payment'}
            </button>
          </form>
        )}
      </section>
    </Shell>
  );
}
