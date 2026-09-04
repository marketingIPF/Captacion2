-- Suscripciones a notificaciones push.
--
-- Una fila por navegador: la misma persona puede tener el móvil y el
-- ordenador, y cada uno tiene su endpoint. `destinatario` es el email de la
-- oficina o el id del agente, según el tipo.
create table if not exists suscripciones_push (
  endpoint      text primary key,
  tipo          text not null check (tipo in ('oficina', 'agente')),
  destinatario  text not null,
  p256dh        text not null,
  auth          text not null,
  creada_en     timestamptz not null default now(),
  ultimo_envio  timestamptz,
  -- Un endpoint caducado responde 404/410: se borra en vez de reintentar
  -- indefinidamente contra un navegador que ya no existe.
  fallos        int not null default 0
);

create index if not exists suscripciones_destinatario_idx
  on suscripciones_push (tipo, destinatario);
