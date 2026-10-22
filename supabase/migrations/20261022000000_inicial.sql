-- Assinaturas: uma linha por usuário. Só as funções (service role) escrevem.
create table public.assinaturas (
  user_id uuid primary key references auth.users on delete cascade,
  plano text check (plano in ('mensal', 'anual')),
  mp_preapproval_id text unique,
  status text not null default 'pending',          -- status do Mercado Pago: pending, authorized, paused, cancelled
  valido_ate timestamptz,                           -- acesso pago liberado até esta data
  atualizado_em timestamptz not null default now()
);

-- Combinações geradas. "semana" = semana ISO no horário de Brasília, ex.: 2026-S43.
create table public.geracoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  modalidade text not null,
  semana text not null,
  gratis boolean not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
-- Garante no banco o limite do plano grátis: 1 por modalidade por semana, mesmo com cliques simultâneos.
create unique index geracoes_cota_gratis on public.geracoes (user_id, modalidade, semana) where gratis;
create index geracoes_usuario_data on public.geracoes (user_id, criado_em desc);

-- Registro bruto das notificações do Mercado Pago, para auditoria.
create table public.eventos_pagamento (
  id bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  tipo text,
  recurso_id text,
  corpo jsonb
);

alter table public.assinaturas enable row level security;
alter table public.geracoes enable row level security;
alter table public.eventos_pagamento enable row level security;

create policy "usuario le a propria assinatura" on public.assinaturas for select using (auth.uid() = user_id);
create policy "usuario le as proprias geracoes" on public.geracoes for select using (auth.uid() = user_id);
-- Sem políticas de escrita: inserções e atualizações só via service role nas Edge Functions.

create or replace function public.e_assinante(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assinaturas where user_id = uid and valido_ate > now());
$$;
