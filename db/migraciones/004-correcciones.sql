-- Un agente puede reenviar una ficha para corregir un dato. El envío ya era
-- idempotente por id (on conflict do update), así que la ficha se actualizaba
-- en vez de duplicarse — pero en la oficina no había forma de notarlo: la
-- ficha seguía en su sitio del listado, con el mismo aspecto.
alter table fichas add column if not exists corregida_en timestamptz;
alter table fichas add column if not exists envios int not null default 1;

-- Para poder ordenar por "lo último que ha cambiado", que es lo que la oficina
-- quiere ver: una corrección importa tanto como una captación nueva.
create index if not exists fichas_movimiento_idx
  on fichas (coalesce(corregida_en, recibida_en) desc);
