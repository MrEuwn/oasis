import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth.js';
import RoleCards from '@/components/RoleCards';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.persona === 'admin' ? '/admin' : '/radar');

  return (
    <div className="l4">
      <header className="l4-top">
        <div className="l4-brand">
          <b>OASIS</b>
          <span className="mono-label">demo access</span>
        </div>
        <span className="mono-note l4-top-mid">one tap · no password</span>
        <a className="l4-live" href="/" style={{ textDecoration: 'none' }}>← landing</a>
      </header>

      <main className="l4-body" style={{ gridTemplateColumns: 'minmax(0,1fr) 504px' }}>
        <section className="l4-hero">
          <p className="mono-label">demo access</p>
          <h1>Enter OASIS.</h1>
          <p className="l4-lede">
            Two roles. Admin opens the detection dashboard, User opens the single table screen.
            Demo host, guest and navigator stay available underneath for the rest of the PRD.
          </p>
          <p className="mono-note l4-fine">
            Campus Google sign-in stays the production path in the PRD; this build ships demo accounts only.
          </p>
        </section>
        <aside className="l4-roles">
          <RoleCards />
        </aside>
      </main>
    </div>
  );
}
