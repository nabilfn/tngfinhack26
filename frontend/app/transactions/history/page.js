'use client';

import { useEffect, useState } from 'react';
import Shell from '../../../components/Shell';
import { api } from '../../../lib/api';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/transactions').then((d) => setTransactions(d.transactions || [])).catch((e) => setErr(e.message));
  }, []);

  return (
    <Shell>
      <section className="card">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        {err && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="mt-5 space-y-3">
          {transactions.length === 0 && <p className="text-slate-500">No transactions yet.</p>}
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {tx.role === 'PAYER' ? `Payment to ${tx.receiverEmail}` : `Request from ${tx.payerEmail}`}
                  </p>
                  <p className="text-sm text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Role: {tx.role}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.role === 'PAYER' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {tx.role === 'PAYER' ? '-' : '+'} RM {Number(tx.amount).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-500">{tx.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
