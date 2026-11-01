-- Target schema for the Supabase migration. Not used by the JSON-store build.
-- Shapes match lib/seed.js and lib/domain.js one-for-one; all writes are meant to
-- go through Edge Functions or security-definer SQL, never from the client.

create type booking_kind as enum ('booked', 'walk_in');
create type booking_status as enum ('reserved', 'active', 'completed', 'cancelled', 'expired');
create type member_role as enum ('host', 'guest');
create type member_status as enum ('joined', 'checked_in', 'left', 'expired', 'completed');
create type table_mode as enum ('deep_work', 'networking');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  study_program text,
  intake_year int,
  points_balance int not null default 0 check (points_balance >= 0),
  checkin_streak int not null default 0,
  perks_paused_until timestamptz,
  email text unique,
  is_demo boolean not null default false,
  persona text,
  created_at timestamptz not null default now()
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building text,
  floor int,
  map_x numeric,
  map_y numeric,
  is_demo boolean not null default false
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  label text not null,
  capacity int not null check (capacity between 1 and 12),
  is_priority boolean not null default false,
  qr_secret_hash text,
  reported_busy_until timestamptz,
  is_demo boolean not null default false,
  unique (space_id, label)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id) on delete cascade,
  host_id uuid not null references profiles (id) on delete cascade,
  kind booking_kind not null default 'booked',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'reserved',
  checkin_deadline timestamptz not null,
  open_seats int not null default 0 check (open_seats >= 0),
  mode table_mode,
  topic_tag text,
  note text check (char_length(note) <= 140),
  created_via text not null default 'app',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table booking_members (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null,
  status member_status not null default 'joined',
  norms_accepted_at timestamptz,
  checked_in_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (booking_id, user_id)
);

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  event text not null,
  points int not null check (points > 0),
  created_at timestamptz not null default now()
);

create table status_reports (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table mode_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  respected boolean not null,
  created_at timestamptz not null default now(),
  unique (booking_id, user_id)
);

create table navigator_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  prompt text,
  parsed_intent jsonb,
  tools_called text,
  outcome text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index bookings_table_live on bookings (table_id, status, ends_at);
create index bookings_host on bookings (host_id, status);
create index members_user on booking_members (user_id, status);
create index ledger_user_day on points_ledger (user_id, created_at desc);

-- A live seat count the Radar can read without trusting the client.
create view table_state as
select
  t.id,
  t.space_id,
  t.label,
  t.capacity,
  t.is_priority,
  b.id as booking_id,
  b.mode,
  b.status as booking_status,
  b.ends_at,
  b.checkin_deadline,
  greatest(
    b.open_seats - coalesce((
      select count(*) from booking_members m
      where m.booking_id = b.id and m.role = 'guest' and m.status in ('joined', 'checked_in')
    ), 0),
    0
  ) as seats_free,
  case
    when b.id is null then 'empty'
    when b.open_seats > 0 then 'open'
    else 'full'
  end as status
from tables t
left join bookings b
  on b.table_id = t.id
 and b.status in ('reserved', 'active')
 and b.ends_at > now();

alter table profiles enable row level security;
alter table spaces enable row level security;
alter table tables enable row level security;
alter table bookings enable row level security;
alter table booking_members enable row level security;
alter table points_ledger enable row level security;
alter table status_reports enable row level security;
alter table mode_feedback enable row level security;
alter table navigator_runs enable row level security;

-- Everyone signed in may read the shared picture, but only inside their own campus.
create policy read_spaces on spaces for select to authenticated
  using (is_demo = (select is_demo from profiles where id = auth.uid()));
create policy read_tables on tables for select to authenticated
  using (is_demo = (select is_demo from profiles where id = auth.uid()));
create policy read_bookings on bookings for select to authenticated
  using (is_demo = (select is_demo from profiles where id = auth.uid()));
create policy read_members on booking_members for select to authenticated using (true);
create policy read_own_points on points_ledger for select to authenticated using (user_id = auth.uid());
create policy read_own_profile on profiles for select to authenticated using (id = auth.uid());

-- No insert/update/delete policies: writes only happen through Edge Functions
-- using the service role, which is never shipped to the browser.
