'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Shell from '../../../../components/Shell';
import { api } from '../../../../lib/api';

export default function Result() {
  const { id } = useParams();
  const [tx, setTx] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api(`/transactions/${id}/result`).then(setTx).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <Shell><div className="card text-red-700">{err}</div></Shell>;
  if (!tx) return <Shell><div className="card">Loading result...</div></Shell>;
  const isSuccess = tx.status === 'SUCCESS' || tx.status === 'SUCCESS_WITH_FALLBACK';

  return (
    <Shell>
      <div className="card mx-auto max-w-xl">
        <p className="text-slate-500">Transaction result</p>
        <h2 className={`mt-2 text-4xl font-bold ${isSuccess ? 'text-emerald-700' : 'text-red-700'}`}>{tx.status}</h2>
        <div className="mt-6 space-y-2 text-slate-700">
          <p>Recipient: <b>{tx.recipient}</b></p>
          <p>Amount: <b>RM {Number(tx.amount).toFixed(2)}</b></p>
          <p>Method: <b>{tx.method || '-'}</b></p>
          {tx.confidenceScore !== null && tx.confidenceScore !== undefined && <p>Confidence: <b>{Number(tx.confidenceScore).toFixed(2)}%</b></p>}
          {tx.failureReason && <p className="text-red-600">Reason: {tx.failureReason}</p>}
        </div>
        <Link className="btn-primary mt-6 inline-block" href="/dashboard">Back to Dashboard</Link>
      </div>
    </Shell>
  );
}
