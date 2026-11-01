import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoLogin from '@/components/DemoLogin';
import { currentUser, googleConfigured } from '@/lib/auth.js';

const ERRORS = {
  domain: 'That email domain is not on the campus allowlist. Use your UPNVJT student account, or try the demo.',
  state: 'The sign-in attempt expired. Please try again.',
  google: 'Google sign-in could not be completed. Try again, or use the demo.',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const user = await currentUser();
  if (user) redirect('/radar');
  const configured = googleConfigured();
  const unconfigured = params?.google === 'unconfigured' || (!configured && params?.google);
  const error = params?.error ? ERRORS[params.error] : null;

  return (
    <div className="landing">
      <div className="wrap" style={{ maxWidth: 520, paddingTop: 32, paddingBottom: 64 }}>
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">◉</span> OASIS
        </Link>

        <h1 style={{ fontSize: '1.8rem', margin: '24px 0 8px' }}>Sign in</h1>
        <p className="hint" style={{ marginBottom: 24 }}>
          Students of UPN Veteran Jawa Timur. Judges: use the demo, no account needed.
        </p>

        {error && <p className="error" style={{ marginBottom: 14 }}>{error}</p>}

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>One-Click Demo Login</h3>
          <p style={{ marginBottom: 14 }}>Signs you in as Demo Seeker, on a separate demo campus.</p>
          <DemoLogin primary={false} />
        </div>

        <div className="card">
          <h3>Campus Google account</h3>
          {configured ? (
            <a className="btn btn-block" href="/api/auth/google" style={{ marginTop: 10 }}>
              Sign in with campus Google
            </a>
          ) : (
            <>
              <p style={{ marginBottom: 10 }}>
                Google OAuth is not configured on this deployment. Set <code>GOOGLE_CLIENT_ID</code> and{' '}
                <code>GOOGLE_CLIENT_SECRET</code> to enable it; the domain allowlist is enforced server-side.
              </p>
              <button className="btn btn-block" disabled>Sign in with campus Google</button>
            </>
          )}
          <p className="hint" style={{ marginTop: 10 }}>
            Only institutional domains are accepted, checked on the server — not in the browser.
          </p>
        </div>

        <p className="hint" style={{ marginTop: 20 }}>
          <Link href="/">← Back to the landing page</Link>
        </p>
      </div>
    </div>
  );
}
