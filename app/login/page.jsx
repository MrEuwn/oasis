import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoLogin from '@/components/DemoLogin';
import { currentUser } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect('/radar');

  return (
    <div className="landing">
      <div className="wrap" style={{ maxWidth: 520, paddingTop: 32, paddingBottom: 64 }}>
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">◉</span> OASIS
        </Link>

        <h1 style={{ fontSize: '1.8rem', margin: '24px 0 8px' }}>Enter OASIS</h1>
        <p className="hint" style={{ marginBottom: 24 }}>
          One tap, no password. Pick the persona you want to demonstrate.
        </p>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>One-Click Demo Login</h3>
          <p style={{ marginBottom: 14 }}>Signs you in as Demo Seeker, on a separate demo campus.</p>
          <DemoLogin primary={false} />
        </div>

        <div className="card">
          <h3>Campus accounts</h3>
          <p>
            This build runs on demo accounts only, by team decision for the STACK submission. The PRD keeps
            institutional Google sign-in as the production path; the server-side domain allowlist would live in
            <code>lib/auth.js</code>.
          </p>
        </div>

        <p className="hint" style={{ marginTop: 20 }}>
          <Link href="/">← Back to the landing page</Link>
        </p>
      </div>
    </div>
  );
}
