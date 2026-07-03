-- ============================================================
-- Estado Result — Schema para Supabase
-- Ejecutar en SQL Editor del dashboard de Supabase
-- ============================================================

-- 1. VENTAS (Maxirest resúmenes mensuales)
create table public.ventas (
  id bigint generated always as identity primary key,
  fecha date not null,
  neto numeric not null default 0,
  iva numeric not null default 0,
  total numeric not null default 0,
  categoria text,
  comprobante text,
  medio_pago text,
  observaciones text,
  -- Desglose Maxirest
  val_total numeric default 0,
  val_cantidad integer default 0,
  val_efectivo numeric default 0,
  val_efectivo_cantidad integer default 0,
  val_tarjetas numeric default 0,
  val_tarjetas_cantidad integer default 0,
  val_otros numeric default 0,
  val_otros_cantidad integer default 0,
  val_factura_b_elec numeric default 0,
  val_factura_b_elec_cantidad integer default 0,
  val_factura_a_elec numeric default 0,
  val_factura_a_elec_cantidad integer default 0,
  val_factura_b numeric default 0,
  val_factura_b_cantidad integer default 0,
  val_turno_am numeric default 0,
  val_turno_am_cantidad integer default 0,
  val_turno_pm numeric default 0,
  val_turno_pm_cantidad integer default 0,
  val_mostrador numeric default 0,
  val_mostrador_cantidad integer default 0,
  val_salon numeric default 0,
  val_salon_cantidad integer default 0,
  val_exterior numeric default 0,
  val_exterior_cantidad integer default 0,
  val_producto numeric default 0,
  val_producto_cantidad integer default 0,
  val_stock numeric default 0,
  val_stock_cantidad integer default 0,
  val_neto_acf numeric default 0,
  val_iva_acf numeric default 0,
  val_anulaciones numeric default 0,
  created_at timestamptz default now()
);

-- 2. COMPRAS (ARCA / Mis Comprobantes)
create table public.compras (
  id bigint generated always as identity primary key,
  fecha date not null,
  tipo_comp text,
  nro_comp text,
  cuit text,
  entidad text,
  neto numeric not null default 0,
  iva numeric not null default 0,
  otros_tributos numeric default 0,
  total numeric not null default 0,
  iva_pct numeric default 0,
  rubro text,
  created_at timestamptz default now()
);

-- 3. EMPLEADOS (Planilla de sueldos)
create table public.empleados (
  id bigint generated always as identity primary key,
  fecha_periodo date not null,
  nombre text not null,
  tarea text,
  dni text,
  legajo text,
  jornada text,
  total_hs numeric default 0,
  recibo numeric default 0,
  negro_enc bytea, -- sueldos en negro, encriptado. Ver seccion ENCRIPTACION mas abajo.
  costo_total numeric default 0,
  created_at timestamptz default now()
);

-- 4. COSTOS MANUALES (gastos fijos + retenciones)
create table public.costos_manuales (
  id bigint generated always as identity primary key,
  fecha date not null,
  tipo_movimiento text not null default 'EGRESO',
  origen_dato text default 'MANUAL',
  rubro text not null,
  sub_rubro text,
  importe_total numeric not null default 0,
  importe_neto numeric default 0,
  importe_iva numeric default 0,
  metodo_pago text,
  observaciones text,
  created_at timestamptz default now()
);

-- 5. CATEGORIAS (mapeo CUIT → categoría para proveedores)
create table public.categorias (
  id bigint generated always as identity primary key,
  cuit text not null unique,
  categoria text not null,
  updated_at timestamptz default now()
);

-- 6. CONFIG DEL NEGOCIO (una sola fila, singleton)
create table public.config_negocio (
  id integer primary key default 1 check (id = 1),
  local_nombre text,
  local_cuit text,
  objetivo_margen numeric,
  objetivo_ventas numeric,
  comision_tarjetas numeric,
  comision_otros numeric,
  comision_efectivo numeric,
  pct_cargas_sociales numeric,
  kw_estructural text,
  kw_cmv text,
  alicuota_iva numeric default 0.21,
  updated_at timestamptz default now()
);

-- 7. AJUSTES POR PERIODO (IPC y MEP por mes)
create table public.ajustes_periodo (
  id bigint generated always as identity primary key,
  periodo text not null unique,  -- formato: '2026-07'
  ipc numeric default 1,
  mep numeric default 1000,
  updated_at timestamptz default now()
);

-- ============================================================
-- INDICES para queries por rango de fecha (el uso principal)
-- ============================================================
create index idx_ventas_fecha on public.ventas (fecha);
create index idx_compras_fecha on public.compras (fecha);
create index idx_empleados_periodo on public.empleados (fecha_periodo);
create index idx_costos_fecha on public.costos_manuales (fecha);

-- ============================================================
-- ENCRIPTACION: sueldos en negro (empleados.negro_enc)
-- Cierra hallazgo H4 de audit-legal-contable-2026-07.md — la clave vive solo
-- en private.keys (schema no expuesto por PostgREST, sin grants a anon ni
-- authenticated). El insert pasa por insert_empleado() (SECURITY DEFINER,
-- corre como dueno de la tabla) y la lectura por la vista empleados_dec.
-- Ni la clave ni el texto plano llegan nunca al bundle JS del cliente.
-- ============================================================
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table private.keys (
  name  text primary key,
  value text not null
);
revoke all on private.keys from public;

insert into private.keys (name, value) values ('negro_key', encode(extensions.gen_random_bytes(32), 'hex'));

create or replace function public.insert_empleado(
  p_fecha_periodo date,
  p_nombre        text,
  p_tarea         text,
  p_dni           text,
  p_legajo        text,
  p_jornada       text,
  p_total_hs      numeric,
  p_recibo        numeric,
  p_negro         numeric,
  p_costo_total   numeric
) returns bigint
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_id  bigint;
  v_key text;
begin
  select value into v_key from private.keys where name = 'negro_key';

  insert into public.empleados
    (fecha_periodo, nombre, tarea, dni, legajo, jornada, total_hs, recibo, negro_enc, costo_total)
  values
    (p_fecha_periodo, p_nombre, p_tarea, p_dni, p_legajo, p_jornada, p_total_hs, p_recibo,
     extensions.pgp_sym_encrypt(coalesce(p_negro, 0)::text, v_key), p_costo_total)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.empleados_dec as
select
  id, fecha_periodo, nombre, tarea, dni, legajo, jornada, total_hs, recibo,
  extensions.pgp_sym_decrypt(negro_enc, (select value from private.keys where name = 'negro_key'))::numeric as negro,
  costo_total, created_at
from public.empleados;

-- ============================================================
-- RLS: requiere sesion autenticada (Supabase Auth, cuentas individuales)
-- Cerrado 2026-07-03 — hallazgo C2 de audit-legal-contable-2026-07.md
-- ============================================================
alter table public.ventas enable row level security;
alter table public.compras enable row level security;
alter table public.empleados enable row level security;
alter table public.costos_manuales enable row level security;
alter table public.categorias enable row level security;
alter table public.config_negocio enable row level security;
alter table public.ajustes_periodo enable row level security;

-- Policies: solo el rol authenticated (anon queda sin acceso por default)
create policy "authenticated_all" on public.ventas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.compras for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.empleados for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.costos_manuales for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.categorias for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.config_negocio for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.ajustes_periodo for all to authenticated using (true) with check (true);

-- audit_log no esta creada en este schema (se creo ad-hoc en Supabase), pero tambien
-- tiene la misma policy "authenticated_all" aplicada directo en prod.

-- Grants: el rol authenticated no los tenia por default (mismo gotcha que anon en
-- su momento) — sin esto, RLS deja pasar pero Postgres igual bloquea con "permission
-- denied for table X". Aplicado en las 8 tablas (incluye audit_log).
grant select, insert, update, delete on public.ventas          to authenticated;
grant select, insert, update, delete on public.compras         to authenticated;
-- empleados: sin insert/update directo — negro_enc solo se escribe encriptado
-- via insert_empleado(). select y delete se mantienen (conteos y borrado de periodo).
grant select, delete on public.empleados                       to authenticated;
grant select, insert, update, delete on public.costos_manuales to authenticated;
grant select, insert, update, delete on public.categorias      to authenticated;
grant select, insert, update, delete on public.config_negocio  to authenticated;
grant select, insert, update, delete on public.ajustes_periodo to authenticated;
grant select, insert, update, delete on public.audit_log       to authenticated;

-- Encriptacion de sueldos en negro: unico camino de escritura/lectura del monto real.
revoke all on function public.insert_empleado from public;
grant execute on function public.insert_empleado(date, text, text, text, text, text, numeric, numeric, numeric, numeric) to authenticated;

revoke all on public.empleados_dec from public;
grant select on public.empleados_dec to authenticated;

-- Hardening: anon no necesita ningun grant de tabla — RLS ya lo bloquea, pero
-- si alguna vez se deshabilita RLS por error, sin esto anon recupera acceso
-- total. Defensa en profundidad (no habia exploit activo antes de esto).
revoke all on public.ventas          from anon;
revoke all on public.compras         from anon;
revoke all on public.empleados       from anon;
revoke all on public.costos_manuales from anon;
revoke all on public.categorias      from anon;
revoke all on public.config_negocio  from anon;
revoke all on public.ajustes_periodo from anon;
revoke all on public.audit_log       from anon;
revoke all on public.empleados_dec   from anon;
revoke all on function public.insert_empleado(date, text, text, text, text, text, numeric, numeric, numeric, numeric) from anon;

-- Insertar fila singleton de config
insert into public.config_negocio (id) values (1);
