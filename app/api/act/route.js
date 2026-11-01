import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { mutate } from '@/lib/store.js';
import { seedDemoState } from '@/lib/seed.js';
import {
  cancelBooking,
  checkIn,
  createBooking,
  endSession,
  joinBooking,
  modeFeedback,
  removeGuest,
  reportBusy,
  scanSit,
} from '@/lib/domain.js';
import { buildState } from '@/lib/view.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  const result = await mutate((db) => {
    const me = db.profiles.find((p) => p.id === user.id);
    if (!me) return { ok: false, error: 'Profile missing.' };
    switch (action) {
      case 'create_booking':
        return createBooking(db, me, {
          tableId: body.tableId,
          duration: Number(body.duration) || 60,
          mode: body.mode || null,
          openSeats: Number(body.openSeats) || 0,
          topic: body.topic || '',
          note: body.note || '',
          startAt: body.startAt || null,
        });
      case 'join':
        return joinBooking(db, me, { bookingId: body.bookingId, normsAccepted: Boolean(body.normsAccepted) });
      case 'cancel':
        return cancelBooking(db, me, { bookingId: body.bookingId });
      case 'checkin':
        return checkIn(db, me, { tableId: body.tableId, token: body.token });
      case 'scan_sit':
        return scanSit(db, me, {
          tableId: body.tableId,
          token: body.token,
          duration: Number(body.duration) || 60,
        });
      case 'end':
        return endSession(db, me, { bookingId: body.bookingId, action: body.endAction || 'leave' });
      case 'report_busy':
        return reportBusy(db, me, { tableId: body.tableId });
      case 'remove_guest':
        return removeGuest(db, me, { bookingId: body.bookingId, userId: body.userId });
      case 'mode_feedback':
        return modeFeedback(db, me, { bookingId: body.bookingId, respected: Boolean(body.respected) });
      case 'reset_demo':
        if (!me.is_demo) return { ok: false, error: 'Demo mode only.' };
        seedDemoState(db);
        return { ok: true };
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  });

  const state = await buildState(user);
  const { booking, ...rest } = result;
  return NextResponse.json({ ...rest, booking_id: booking?.id, state });
}
