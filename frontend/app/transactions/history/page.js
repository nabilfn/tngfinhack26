'use client';

import { useEffect, useState } from 'react';
import Shell from '../../../components/Shell';
import { api } from '../../../lib/api';

export default function History() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => { api('/transactions/history').then(setRows).catch((e) => setErr(e.message)); }, []);

  return (
    <Shell>
      <div className="card">
        <h2 className="text-2xl font-bold">Transaction history</h2>
        {err && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-3">Recipient</th><th>Amount</th><th>Method</th><th>Status</th><th>Confidence</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="py-3">{x.recipient}</td><td>RM {Number(x.amount).toFixed(2)}</td><td>{x.method || '-'}</td><td>{x.status}</td><td>{x.confidenceScore !== null && x.confidenceScore !== undefined ? `${Number(x.confidenceScore).toFixed(2)}%` : '-'}</td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
              {!rows.length && !err && <tr><td className="py-6 text-slate-500" colSpan="6">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
