import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoLogin from '@/components/DemoLogin';
import { currentUser } from '@/lib/auth.js';
import { Logo } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect('/radar');

  return (
    <div className="landing">
      <div className="wrap" style={{ maxWidth: 520 }}>
        <header className="topbar-landing">
          <Link className="brand" href="/">
            <Logo size={24} />
            OASIS
          </Link>
          <Link className="mono" href="/">← back</Link>
        </header>

        <div style={{ padding: '48px 0 64px' }}>
          <p className="eyebrow">Demo access</p>
          <h1 style={{ fontSize: '2rem', letterSpacing: '-0.03em', lineHeight: 1.1, fontWeight: 600 }}>
            Enter OASIS
          </h1>
          <p className="hint" style={{ marginTop: 10, marginBottom: 24 }}>
            One tap, no password. Each persona opens a different part of the product.
          </p>

          <div className="card">
            <DemoLogin primary chips />
          </div>

          <p className="hint" style={{ marginTop: 16 }}>
            This build runs on demo accounts only. Campus Google sign-in stays the production path in the PRD.
          </p>
        </div>
      </div>
    </div>
  );
}
