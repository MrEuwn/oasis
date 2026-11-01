import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth.js';
import { buildState } from '@/lib/view.js';
import { AppProvider } from '@/components/AppState';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const state = await buildState(user);
  return (
    <AppProvider initial={state}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
