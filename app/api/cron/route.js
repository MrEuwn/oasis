import { NextResponse } from 'next/server';
import { mutate } from '@/lib/store.js';
import { runJobs } from '@/lib/domain.js';
import { ensureDemoFresh } from '@/lib/seed.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await mutate((db) => {
    const jobs = runJobs(db);
    const reseeded = ensureDemoFresh(db);
    return { ...jobs, reseeded };
  });
  return NextResponse.json({ ok: true, ...result });
}
