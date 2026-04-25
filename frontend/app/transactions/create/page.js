'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../../components/Shell';
import { api } from '../../../lib/api';

export default function CreateTx() {
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const tx = await api('/transactions/create', {
        method: 'POST',
        body: JSON.stringify({ recipient, amount: Number(amount) }),
      });
      router.push(`/transactions/${tx.id}/method`);
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <form onSubmit={submit} className="card mx-auto max-w-lg space-y-4">
        <h2 className="text-2xl font-bold">Create transaction</h2>
        <p className="text-sm text-slate-500">This creates a pending transaction in PostgreSQL before payment approval.</p>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <input className="input" required value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient / merchant" />
        <input className="input" required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Continue'}</button>
      </form>
    </Shell>
  );
}
