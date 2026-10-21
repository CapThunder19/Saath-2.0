-- Saath 2.0 registrations: run this once in Supabase → SQL Editor → New query → Run.
-- Safe to run again (it only creates what's missing and replaces the functions).

create table if not exists registrations (
  id text primary key,                         -- e.g. SAATH-HWSZ6R
  submitted_at timestamptz not null default now(),
  team_type text not null,                     -- solo | duo
  amount integer,                              -- ₹ paid
  txn_id text unique,                          -- UPI transaction ID; one payment = one registration
  status text not null default 'Pending' check (status in ('Pending', 'Approved')),
  approved_at timestamptz
);

create table if not exists members (
  registration_id text not null references registrations (id) on delete cascade,
  member_no smallint not null,
  name text not null,
  admission_no text not null unique,           -- each student can register only once
  phone text not null,
  course text not null,
  branch text not null,
  email text not null,
  photo_path text not null,                    -- file in the member-photos storage bucket
  primary key (registration_id, member_no)
);

create index if not exists registrations_submitted_at on registrations (submitted_at desc);

-- Only the website's server (service role key) may touch the data; the public anon key gets nothing.
alter table registrations enable row level security;
alter table members enable row level security;

-- Private bucket for member photos (skipped outside Supabase, e.g. in local tests).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------- Functions the website calls ----------

-- Saves a team in one transaction. The unique constraints decide duplicates, so
-- many people can register at the same moment with no queue.
-- Returns {ok:true} | {ok:false, duplicates:[member indexes]} | {ok:false, duplicateTxn:true}.
create or replace function register_team(p_id text, p_team_type text, p_amount integer, p_txn_id text, p_members jsonb)
returns jsonb language plpgsql as $$
declare
  v_taken jsonb;
  v_constraint text;
begin
  -- A retry of a submission that was already saved (its reply got lost).
  if exists (select 1 from registrations where id = p_id) then
    return jsonb_build_object('ok', true, 'repeat', true);
  end if;

  select coalesce(jsonb_agg(m.ord - 1), '[]') into v_taken
  from jsonb_array_elements(p_members) with ordinality as m (val, ord)
  where exists (select 1 from members x where x.admission_no = upper(m.val ->> 'admissionNo'));
  if jsonb_array_length(v_taken) > 0 then
    return jsonb_build_object('ok', false, 'duplicates', v_taken);
  end if;

  insert into registrations (id, team_type, amount, txn_id) values (p_id, p_team_type, p_amount, p_txn_id);
  insert into members (registration_id, member_no, name, admission_no, phone, course, branch, email, photo_path)
  select p_id, m.ord, m.val ->> 'name', upper(m.val ->> 'admissionNo'), m.val ->> 'phone', m.val ->> 'course',
         m.val ->> 'branch', lower(m.val ->> 'email'), m.val ->> 'photoPath'
  from jsonb_array_elements(p_members) with ordinality as m (val, ord);

  return jsonb_build_object('ok', true);
exception when unique_violation then
  -- Someone else saved the same admission number / transaction ID at this very moment.
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'registrations_pkey' then
    return jsonb_build_object('ok', true, 'repeat', true);
  elsif v_constraint = 'registrations_txn_id_key' then
    return jsonb_build_object('ok', false, 'duplicateTxn', true);
  end if;
  select coalesce(jsonb_agg(m.ord - 1), '[]') into v_taken
  from jsonb_array_elements(p_members) with ordinality as m (val, ord)
  where exists (select 1 from members x where x.admission_no = upper(m.val ->> 'admissionNo'));
  return jsonb_build_object('ok', false, 'duplicates', v_taken);
end $$;

-- Which of these admission numbers are already registered (as indexes into the list).
create or replace function check_admissions(p_admissions jsonb)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(a.ord - 1), '[]')
  from jsonb_array_elements_text(p_admissions) with ordinality as a (val, ord)
  where exists (select 1 from members x where x.admission_no = upper(trim(a.val)));
$$;

-- The registration a student belongs to, for "View ticket".
create or replace function find_member(p_admission text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'registrationId', r.id, 'memberNo', m.member_no, 'name', m.name, 'status', r.status,
    'teamSize', (select count(*) from members x where x.registration_id = r.id))
  from members m join registrations r on r.id = m.registration_id
  where m.admission_no = upper(trim(p_admission));
$$;

-- One member's ticket details (the website then loads the photo from storage).
create or replace function get_member(p_id text, p_member_no integer)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'name', m.name, 'branch', m.branch, 'status', r.status, 'photoPath', m.photo_path,
    'teamSize', (select count(*) from members x where x.registration_id = r.id))
  from members m join registrations r on r.id = m.registration_id
  where r.id = p_id and m.member_no = p_member_no;
$$;

-- Everything for the admin dashboard and the Excel download, newest first.
create or replace function list_registrations()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(t.reg order by t.submitted_at desc), '[]')
  from (
    select r.submitted_at, jsonb_build_object(
      'registrationId', r.id,
      'submittedAt', to_char(r.submitted_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"'),
      'teamType', r.team_type,
      'status', r.status,
      'approvedAt', coalesce(to_char(r.approved_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"'), ''),
      'amount', coalesce(r.amount::text, ''),
      'txnId', coalesce(r.txn_id, ''),
      'members', (
        select jsonb_agg(jsonb_build_object(
          'memberNo', m.member_no, 'name', m.name, 'admissionNo', m.admission_no, 'phone', m.phone,
          'course', m.course, 'branch', m.branch, 'email', m.email) order by m.member_no)
        from members m where m.registration_id = r.id)
    ) as reg
    from registrations r
  ) t;
$$;

-- Marks a registration approved; returns {approvedAt} or null if it doesn't exist.
create or replace function approve_registration(p_id text)
returns jsonb language plpgsql as $$
declare v_at timestamptz;
begin
  update registrations set status = 'Approved', approved_at = coalesce(approved_at, now())
  where id = p_id returning approved_at into v_at;
  if v_at is null then return null; end if;
  return jsonb_build_object('approvedAt', to_char(v_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"'));
end $$;

-- One-off import of a registration from the old Google Sheet, keeping its dates and status.
create or replace function import_registration(
  p_id text, p_submitted_at timestamptz, p_team_type text, p_amount integer, p_txn_id text,
  p_status text, p_approved_at timestamptz, p_members jsonb)
returns jsonb language plpgsql as $$
declare v_constraint text;
begin
  if exists (select 1 from registrations where id = p_id) then
    return jsonb_build_object('ok', true, 'skipped', 'already imported');
  end if;
  insert into registrations (id, submitted_at, team_type, amount, txn_id, status, approved_at)
  values (p_id, coalesce(p_submitted_at, now()), p_team_type, p_amount, nullif(p_txn_id, ''),
          case when p_status = 'Approved' then 'Approved' else 'Pending' end, p_approved_at);
  insert into members (registration_id, member_no, name, admission_no, phone, course, branch, email, photo_path)
  select p_id, (m.val ->> 'memberNo')::smallint, m.val ->> 'name', upper(m.val ->> 'admissionNo'), m.val ->> 'phone',
         m.val ->> 'course', m.val ->> 'branch', lower(m.val ->> 'email'), m.val ->> 'photoPath'
  from jsonb_array_elements(p_members) as m (val);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  return jsonb_build_object('ok', false, 'error', 'duplicate ' || v_constraint);
end $$;

-- Only the server (service role) may call these.
do $$
declare f text;
begin
  foreach f in array array[
    'register_team(text, text, integer, text, jsonb)', 'check_admissions(jsonb)', 'find_member(text)',
    'get_member(text, integer)', 'list_registrations()', 'approve_registration(text)',
    'import_registration(text, timestamptz, text, integer, text, text, timestamptz, jsonb)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;
