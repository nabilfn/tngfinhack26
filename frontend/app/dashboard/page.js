'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell from '../../components/Shell';
import CameraCapture from '../../components/CameraCapture';
import { api, logout } from '../../lib/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollFace, setEnrollFace] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');

  function load() {
    api('/dashboard')
      .then(setData)
      .catch((e) => {
        setErr(e.message);
        logout();
        window.location.href = '/login';
      });
  }

  useEffect(() => { load(); }, []);

  async function submitEnroll() {
    if (!enrollFace) { setEnrollMsg('Please capture a face image first.'); return; }
    setEnrolling(true);
    setEnrollMsg('');
    try {
      const res = await api('/enroll-face', { method: 'POST', body: JSON.stringify({ faceImageBase64: enrollFace }) });
      setEnrollMsg('Face enrolled successfully!');
      setShowEnroll(false);
      load(); // refresh dashboard status
    } catch (e) {
      setEnrollMsg(e.message);
    } finally {
      setEnrolling(false);
    }
  }

  if (!data) return <Shell><div className="card">{err || 'Loading dashboard...'}</div></Shell>;
  const latest = data.transactions?.[0];
  const enrolled = data.faceEnrollmentStatus === 'ENROLLED';

  return (
    <Shell>
      <div className="grid gap-5 md:grid-cols-3">
        <section className="card md:col-span-2">
          <p className="text-slate-500">Wallet balance</p>
          <h2 className="mt-2 text-5xl font-bold">RM {Number(data.walletBalance).toFixed(2)}</h2>
          <p className="mt-4 text-slate-600">
            Face2Go status:{' '}
            <b className={enrolled ? 'text-emerald-600' : 'text-red-600'}>
              {data.faceEnrollmentStatus}
            </b>
          </p>
          {!enrolled && (
            <button
              onClick={() => { setShowEnroll(true); setEnrollMsg(''); }}
              className="btn-primary mt-4"
            >
              Enroll Face Now
            </button>
          )}
          {enrolled && (
            <button
              onClick={() => { setShowEnroll(true); setEnrollMsg(''); }}
              className="btn-soft mt-4 text-sm"
            >
              Re-enroll Face
            </button>
          )}
        </section>

        <section className="card">
  <h3 className="font-bold">Quick actions</h3>
  <div className="mt-4 grid gap-3">

    <Link className="btn-primary" href="/transactions/face-pay">
      FacePay (Scan & Pay)
    </Link>

    <Link className="btn-soft" href="/transactions/history">
      Transaction History
    </Link>

  </div>
</section>

        {showEnroll && (
          <section className="card md:col-span-3">
            <h3 className="font-bold">Face Enrollment</h3>
            <p className="mt-1 text-sm text-slate-500">Capture a clear front-facing photo. This will be stored in AWS Rekognition.</p>
            <div className="mt-4">
              <CameraCapture onCapture={setEnrollFace} label="Capture face" />
            </div>
            {enrollMsg && (
              <p className={`mt-3 rounded-2xl p-3 text-sm ${enrollMsg.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {enrollMsg}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button onClick={submitEnroll} disabled={enrolling || !enrollFace} className="btn-primary">
                {enrolling ? 'Enrolling... (up to 20s)' : 'Submit Enrollment'}
              </button>
              <button onClick={() => setShowEnroll(false)} className="btn-soft">Cancel</button>
            </div>
          </section>
        )}

        <section className="card md:col-span-3">
          <h3 className="font-bold">Latest transaction</h3>
          {latest ? (
            <div className="mt-3 grid gap-2 text-slate-700 sm:grid-cols-5">
              <p><span className="text-slate-500">Role</span><br /><b>{latest.role}</b></p>
              <p><span className="text-slate-500">Payer</span><br /><b>{latest.payerEmail}</b></p>
              <p><span className="text-slate-500">Receiver</span><br /><b>{latest.receiverEmail}</b></p>
              <p><span className="text-slate-500">Amount</span><br /><b>RM {Number(latest.amount).toFixed(2)}</b></p>
              <p><span className="text-slate-500">Method</span><br /><b>{latest.method || 'Pending'}</b></p>
              <p><span className="text-slate-500">Status</span><br /><b>{latest.status}</b></p>
            </div>
          ) : (
            <p className="mt-2 text-slate-600">No transactions yet.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
