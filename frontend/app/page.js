import Link from 'next/link';
import Shell from '../components/Shell';

export default function Home() {
  return (
    <Shell>
      <div className="card max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">FINHACK prototype</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight">Pay even without your phone or wallet.</h2>
        <p className="mt-4 text-slate-600">
          Face2Go authorizes wallet payments using AWS Rekognition face verification with secure fallback passcode.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn-primary" href="/login">Login</Link>
          <Link className="btn-soft" href="/signup">Create account</Link>
        </div>
      </div>
    </Shell>
  );
}
