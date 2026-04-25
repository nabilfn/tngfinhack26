'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '../../components/Shell';
import { api, logout } from '../../lib/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => {
        setErr(e.message);
        logout();
        window.location.href = '/login';
      });
  }, []);

  if (!data) return <Shell><div className="card">{err || 'Loading dashboard...'}</div></Shell>;
  const latest = data.transactions?.[0];

  return (
    <Shell>
      <div className="grid gap-5 md:grid-cols-3">
        <section className="card md:col-span-2">
          <p className="text-slate-500">Wallet balance</p>
          <h2 className="mt-2 text-5xl font-bold">RM {Number(data.walletBalance).toFixed(2)}</h2>
          <p className="mt-4 text-slate-600">
            Face2Go status: <b className="text-slate-950">{data.faceEnrollmentStatus}</b>
          </p>
        </section>

        <section className="card">
          <h3 className="font-bold">Quick actions</h3>
          <div className="mt-4 grid gap-3">
            <Link className="btn-primary" href="/transactions/create">Create Transaction</Link>
            <Link className="btn-soft" href="/transactions/history">Transaction History</Link>
          </div>
        </section>

        <section className="card md:col-span-3">
          <h3 className="font-bold">Latest transaction</h3>
          {latest ? (
            <div className="mt-3 grid gap-2 text-slate-700 sm:grid-cols-4">
              <p><span className="text-slate-500">Recipient</span><br /><b>{latest.recipient}</b></p>
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
