'use client';

import { useState } from 'react';
import Link from 'next/link';
import Shell from '../../../components/Shell';
import CameraCapture from '../../../components/CameraCapture';
import { api } from '../../../lib/api';

export default function FacePayPage() {
  const [amount, setAmount] = useState('');
  const [faceImageBase64, setFaceImageBase64] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [risk, setRisk] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [payer, setPayer] = useState(null);

  async function payWithFace() {
    setErr('');
    setMsg('');
    setRisk(null);
    setReceipt(null);
    setPayer(null);
    setLoading(true);

    try {
      const res = await api('/transactions/face-pay', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          faceImageBase64,
        }),
      });

      if (res.risk) setRisk(res.risk);
      if (res.payerIdentified) setPayer(res.payerIdentified);
      if (res.transaction) setReceipt(res.transaction);

      setMsg(res.message || 'Payment completed');
    } catch (e) {
      setErr(e.message || 'FacePay failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="card mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold">FacePay</h2>
          <p className="mt-1 text-sm text-slate-500">
            Receiver enters an amount, scans the payer&apos;s face, and Face2Go authorizes the payment using AWS Rekognition and Bedrock AI.
          </p>
        </div>

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

        {receipt && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-lg font-bold text-emerald-800">
              Payment Receipt
            </h3>

            <div className="mt-4 space-y-2 text-sm text-emerald-900">
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {receipt.status}
              </p>

              <p>
                <span className="font-semibold">Payer:</span>{' '}
                {receipt.payerEmail || payer?.email || 'Identified payer'}
              </p>

              <p>
                <span className="font-semibold">Receiver:</span>{' '}
                {receipt.receiverEmail || 'Current receiver'}
              </p>

              <p>
                <span className="font-semibold">Amount:</span>{' '}
                RM {Number(receipt.amount).toFixed(2)}
              </p>

              <p>
                <span className="font-semibold">Method:</span>{' '}
                {receipt.method}
              </p>

              {receipt.confidenceScore && (
                <p>
                  <span className="font-semibold">Face Confidence:</span>{' '}
                  {Number(receipt.confidenceScore).toFixed(2)}%
                </p>
              )}

              <p className="break-all">
                <span className="font-semibold">Transaction ID:</span>{' '}
                {receipt.id}
              </p>
            </div>

            {risk && (
              <div className="mt-4 rounded-xl bg-white p-3 text-sm">
                <p className="font-semibold text-slate-700">
                  AI Decision
                </p>
                <p>Decision: {risk.decision}</p>
                <p>Risk Level: {risk.riskLevel}</p>
                <p className="text-slate-500">{risk.reason}</p>
              </div>
            )}

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

        {!receipt && risk && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                AI Risk Decision
              </h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {risk.riskLevel}
              </span>
            </div>

            <p className="mt-3 text-sm">
              <span className="font-medium">Decision:</span>{' '}
              {risk.decision}
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {risk.reason}
            </p>
          </div>
        )}

        {!receipt && (
          <>
            <div className="rounded-3xl border border-slate-200 p-4">
              <h3 className="font-semibold">Payment amount</h3>
              <p className="mb-3 mt-1 text-sm text-slate-500">
                Enter the amount to charge the payer.
              </p>

              <input
                className="input"
                type="number"
                min="1"
                step="0.01"
                placeholder="Amount in RM"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 p-4">
              <h3 className="font-semibold">Scan payer face</h3>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Capture the payer&apos;s live face image to identify and authorize the payment.
              </p>

              <CameraCapture
                onCapture={setFaceImageBase64}
                label="Capture payer face"
              />

              <button
                disabled={loading || !amount || !faceImageBase64}
                onClick={payWithFace}
                className="btn-primary mt-4 w-full"
              >
                {loading ? 'Processing FacePay...' : 'Pay with Face2Go'}
              </button>
            </div>
          </>
        )}
      </section>
    </Shell>
  );
}