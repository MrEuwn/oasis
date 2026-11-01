import QRCode from 'qrcode';
import { read } from '@/lib/store.js';
import { qrToken } from '@/lib/domain.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { tableId } = await params;
  const table = read().tables.find((t) => t.id === tableId);
  if (!table) return new Response('Unknown table', { status: 404 });
  const origin = new URL(request.url).origin;
  const target = `${origin}/scan?t=${table.id}&k=${qrToken(table.id)}`;
  const svg = await QRCode.toString(target, { type: 'svg', margin: 1, width: 240 });
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
  });
}
