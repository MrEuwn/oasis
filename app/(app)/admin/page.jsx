import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { adminState } from '@/lib/admin';
import { mutate } from '@/lib/store';
import AdminScreen from '@/components/AdminScreen';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.persona !== 'admin') redirect('/radar');
  const state = await mutate((db) => adminState(db, db.profiles.find((p) => p.id === user.id) || user));
  return <AdminScreen initial={state} />;
}
