create extension if not exists "pgcrypto";

do $$
begin
  create type transaction_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type transaction_source as enum ('manual', 'mock_import');
exception
  when duplicate_object then null;
end
$$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_username_unique
  on users (username);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  type transaction_type not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_slug_unique
  on categories (slug);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type transaction_type not null,
  amount_cents integer not null,
  currency text not null default 'HKD',
  category_id uuid not null references categories (id) on delete restrict,
  transaction_date date not null,
  remarks text,
  source transaction_source not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_cents_positive_check check (amount_cents > 0),
  constraint transactions_currency_hkd_check check (currency = 'HKD'),
  constraint transactions_remarks_length_check check (
    remarks is null or char_length(remarks) <= 280
  )
);

create index if not exists transactions_user_transaction_date_created_at_idx
  on transactions (user_id, transaction_date desc, created_at desc);

create index if not exists transactions_user_category_idx
  on transactions (user_id, category_id);

create index if not exists transactions_user_type_idx
  on transactions (user_id, type);

create unique index if not exists transactions_user_external_ref_unique
  on transactions (user_id, external_ref)
  where external_ref is not null;

create table if not exists "session" (
  sid varchar not null,
  sess json not null,
  expire timestamp(6) not null,
  constraint session_pkey primary key (sid)
);

create index if not exists "IDX_session_expire"
  on "session" (expire);
