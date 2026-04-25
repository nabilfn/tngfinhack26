'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '../../../../components/Shell';
import CameraCapture from '../../../../components/CameraCapture';
import { api } from '../../../../lib/api';

export default function Verify() {
  const { id } = useParams();
  const router = useRouter();
  const [capturedFaceBase64, setCapturedFaceBase64] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!capturedFaceBase64) {
      setErr('Please capture or upload a face image first.');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const data = await api('/transactions/pay/face2go', {
        method: 'POST',
        body: JSON.stringify({ transactionId: id, capturedFaceBase64 }),
      });
      if (data.fallbackRequired) router.push(`/transactions/${id}/fallback`);
      else router.push(`/transactions/${id}/result`);
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="card mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Face2Go verification</h2>
          <p className="mt-1 text-sm text-slate-500">
            Capture the payer face using the live camera. The backend compares it against the enrolled face image using AWS Rekognition.
          </p>
        </div>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <CameraCapture onCapture={setCapturedFaceBase64} label="Capture verification" />
        <button onClick={submit} disabled={loading || !capturedFaceBase64} className="btn-primary w-full">
          {loading ? 'Verifying...' : 'Verify & Pay'}
        </button>
      </div>
    </Shell>
  );
}
