-- Esquema de la base de datos (Neon / Postgres).
-- Ejecutar una vez desde el SQL Editor de Neon, o con:
--   psql "$DATABASE_URL" -f db/schema.sql

create extension if not exists "pgcrypto";

create table if not exists fichas (
  id              uuid primary key,
  creada_en       timestamptz not null default now(),
  recibida_en     timestamptz not null default now(),
  actualizada_en  timestamptz not null default now(),

  -- Columnas desnormalizadas desde `datos`, solo para filtrar y ordenar rápido.
  agente_id       text not null,
  agente_nombre   text not null,
  operacion       text,
  tipo            text,
  referencia      text,
  direccion       text,
  numero          text,
  poblacion       text,
  provincia       text,
  cp              text,
  precio          numeric(12,2),

  -- Estado del seguimiento en oficina.
  -- Borrado reversible desde el panel: la ficha desaparece del listado y del
  -- historial del agente, pero deshacerlo es un UPDATE.
  eliminada_en    timestamptz,
  eliminada_por   text,

  -- Un agente puede reenviar la ficha para corregir un dato: el envío es
  -- idempotente por id, y esto deja constancia de que ha cambiado.
  corregida_en    timestamptz,
  envios          int not null default 1,

  -- Fases del proceso, en orden. "baja" es la salida: la captación no vale.
  -- Vendido y Alquilado son excluyentes segun la operacion, pero eso no se
  -- fuerza aqui: la operacion se puede corregir despues de marcar la fase.
  estado          text not null default 'nueva'
                  check (estado in ('nueva', 'agendada_fotos', 'pendiente',
                                    'publicada', 'reservado', 'vendido',
                                    'alquilado', 'baja')),
  nota_oficina    text,
  actualizada_por text,          -- email de quien lo tocó desde el panel

  -- La ficha íntegra. Así añadir un campo al formulario no obliga a migrar.
  datos           jsonb not null,
  propietarios    jsonb not null default '[]'::jsonb
);

create index if not exists fichas_recibida_idx on fichas (recibida_en desc);
create index if not exists fichas_movimiento_idx
  on fichas (coalesce(corregida_en, recibida_en) desc);
create index if not exists fichas_vivas_idx
  on fichas (coalesce(corregida_en, recibida_en) desc)
  where eliminada_en is null;
create index if not exists fichas_agente_idx   on fichas (agente_id);
create index if not exists fichas_estado_idx   on fichas (estado);
create index if not exists fichas_datos_idx    on fichas using gin (datos);

-- Búsqueda por texto sobre lo que la oficina realmente busca.
create index if not exists fichas_busqueda_idx on fichas using gin (
  to_tsvector('spanish',
    coalesce(direccion,'') || ' ' || coalesce(poblacion,'') || ' ' ||
    coalesce(referencia,'') || ' ' || coalesce(agente_nombre,''))
);

create or replace function fichas_touch() returns trigger as $$
begin
  new.actualizada_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fichas_touch_trg on fichas;
create trigger fichas_touch_trg before update on fichas
  for each row execute function fichas_touch();
