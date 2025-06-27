/* ==========================================================================
   0.  PREP:  drop trigger that references handle_new_user_signup
   ========================================================================== */
drop trigger if exists on_auth_user_created on auth.users;

/* ==========================================================================
   1.  ENUM — ensure it exists in the PUBLIC schema
   ========================================================================== */
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role' and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('admin','regular','specialized');
  end if;
end$$;

/* ==========================================================================
   2.  COLUMN — make user_profiles.role use that enum
   ========================================================================== */
alter table public.user_profiles
  alter column role type public.user_role
  using role::public.user_role,
  alter column role set default 'regular';

/* ==========================================================================
   3.  (RE)CREATE helper function for manual profile creation
   ========================================================================== */
create or replace function public.create_user_profile_manual(
  user_id    uuid,
  user_email text,
  user_token text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  _role  public.user_role := 'regular';
  _json  json;
begin
  if user_email in ('rishabh.biry@gmail.com','biryrishabh01@gmail.com','biryrishabh@gmail.com') then
    _role := 'admin';
  elsif user_token is not null
        and exists (select 1 from public.user_tokens
                    where token = user_token and is_active) then
    _role := 'specialized';
  end if;

  insert into public.users(id,email)               -- mirror scratch table
  values (user_id,user_email)
  on conflict (id) do update set email = excluded.email;

  insert into public.user_profiles(id,email,role,token_used)
  values (user_id,user_email,_role,user_token)
  on conflict (id) do update
     set email = excluded.email,
         role  = excluded.role,
         token_used = excluded.token_used;

  select to_jsonb(up) into _json
  from public.user_profiles up
  where up.id = user_id;

  return _json;
end;
$$;

/* ==========================================================================
   4.  TRIGGER FUNCTION  (runs when auth.users row is created)
   ========================================================================== */
create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.user_role := 'regular';
  _token text;
begin
  _token := new.raw_user_meta_data ->> 'token';

  if new.email in ('rishabh.biry@gmail.com','biryrishabh01@gmail.com','biryrishabh@gmail.com') then
    _role := 'admin';
  elsif _token is not null
        and exists (select 1 from public.user_tokens
                    where token = _token and is_active) then
    _role := 'specialized';
  end if;

  insert into public.user_profiles(id,email,role,token_used)
  values (new.id,new.email,_role,_token)
  on conflict (id) do update
     set email = excluded.email,
         role  = excluded.role,
         token_used = excluded.token_used;

  return new;
exception
  when others then
    raise warning 'handle_new_user_signup failed: %', sqlerrm;
    return new;
end;
$$;

/* ==========================================================================
   5.  RE-CREATE TRIGGER
   ========================================================================== */
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_signup();

/* ==========================================================================
   6.  RLS POLICIES that reference the enum
   ========================================================================== */

-- user_profiles insert during signup
alter table public.user_profiles enable row level security;

drop policy if exists "Allow profile creation during signup" on public.user_profiles;
create policy "Allow profile creation during signup"
  on public.user_profiles
  for insert
  to anon, authenticated, supabase_auth_admin
  with check (true);

-- example admin-only policy, scoped to enum
alter table public.blog_posts enable row level security;

drop policy if exists "Admins can manage all blog posts" on public.blog_posts;
create policy "Admins can manage all blog posts"
  on public.blog_posts
  for all
  to authenticated
  using (exists (
         select 1 from public.user_profiles up
         where up.id = auth.uid()
           and up.role = 'admin'::public.user_role))
  with check (exists (
         select 1 from public.user_profiles up
         where up.id = auth.uid()
           and up.role = 'admin'::public.user_role));

/* ==========================================================================
   7.  DONE — return quick status JSON for debugging
   ========================================================================== */
select json_build_object(
  'enum_exists',  (select exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='user_role' and n.nspname='public')),
  'trigger_exists',(select exists (select 1 from information_schema.triggers where trigger_name='on_auth_user_created')),
  'timestamp',    now()
) as status;