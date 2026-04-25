'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../../components/Shell';
import { api } from '../../../lib/api';

export default function CreateTransaction() {
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
      const tx = await api('/transactions', {
        method: 'POST',
        body: JSON.stringify({ recipient, amount: Number(amount) }),
      });
      sessionStorage.setItem('pendingTransactionId', tx.id);
      router.push('/transactions/verify');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <form onSubmit={submit} className="card mx-auto max-w-xl space-y-4">
        <h2 className="text-2xl font-bold">Create Transaction</h2>
        <p className="text-sm text-slate-500">Enter who you want to pay and the amount to authorize.</p>
        {err && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <input className="input" required placeholder="Recipient name or email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        <input className="input" required type="number" min="0.01" step="0.01" placeholder="Amount, e.g. 12.50" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Continue to Verification'}</button>
      </form>
    </Shell>
  );
}
