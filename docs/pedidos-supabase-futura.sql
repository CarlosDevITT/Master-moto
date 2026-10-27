-- MASTER MOTOS | Pedidos — proposta futura, NÃO EXECUTADA
-- Revisar em staging, validar políticas e planejar migração dos pedidos locais antes da execução.
begin;
create table if not exists public.mm_suppliers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 150),
 whatsapp_e164 text check(whatsapp_e164 is null or whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create table if not exists public.mm_purchase_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 supplier_id uuid not null,
 order_number text not null,
 status text not null default 'draft' check(status in ('draft','confirmed','sent','partially_received','received','cancelled')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,order_number),
 unique(id,user_id),
 foreign key(supplier_id,user_id) references public.mm_suppliers(id,user_id)
);
create table if not exists public.mm_purchase_order_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null,
 sku text not null,
 description text not null,
 application text not null default '',
 quantity_ordered integer not null check(quantity_ordered>0),
 quantity_received integer not null default 0 check(quantity_received>=0 and quantity_received<=quantity_ordered),
 unit_price numeric(14,2) check(unit_price>=0),
 foreign key(order_id,user_id) references public.mm_purchase_orders(id,user_id)
);
create table if not exists public.mm_order_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null,
 event_type text not null,
 detail text not null default '',
 created_at timestamptz not null default now(),
 foreign key(order_id,user_id) references public.mm_purchase_orders(id,user_id)
);
create index if not exists mm_orders_owner_date on public.mm_purchase_orders(user_id,created_at desc);
create index if not exists mm_order_items_owner_order on public.mm_purchase_order_items(user_id,order_id);
create index if not exists mm_order_events_owner_order on public.mm_order_events(user_id,order_id);
alter table public.mm_suppliers enable row level security;
alter table public.mm_purchase_orders enable row level security;
alter table public.mm_purchase_order_items enable row level security;
alter table public.mm_order_events enable row level security;
revoke all on public.mm_suppliers,public.mm_purchase_orders,public.mm_purchase_order_items,public.mm_order_events from anon;
grant select,insert,update on public.mm_suppliers,public.mm_purchase_orders,public.mm_purchase_order_items to authenticated;
grant select,insert on public.mm_order_events to authenticated;
create policy mm_suppliers_owner on public.mm_suppliers for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy mm_orders_owner on public.mm_purchase_orders for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy mm_items_owner on public.mm_purchase_order_items for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy mm_events_select on public.mm_order_events for select to authenticated using(user_id=(select auth.uid()));
create policy mm_events_insert on public.mm_order_events for insert to authenticated with check(user_id=(select auth.uid()));
commit;
-- ATENÇÃO: modelo estrutural preliminar. Antes de produção, restringir atualizações
-- de status/recebimentos a RPC transacional com validação de transições e auditoria,
-- proibir edições indevidas de user_id e impedir eventos falsificados pelo cliente.
