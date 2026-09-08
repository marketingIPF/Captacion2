-- Tres fases más, las del cierre de la operación:
--   Reservado → hay señal, pero no está firmado
--   Vendido   → cerrada como venta
--   Alquilado → cerrada como alquiler
--
-- Vendido y Alquilado son excluyentes: depende de si la captación era de venta
-- o de alquiler. No se fuerza en la base de datos porque la operación se puede
-- corregir después de haber marcado la fase, y bloquear eso obligaría a la
-- oficina a deshacer dos cosas para arreglar una.
alter table fichas drop constraint if exists fichas_estado_check;

alter table fichas add constraint fichas_estado_check
  check (estado in ('nueva', 'agendada_fotos', 'pendiente', 'publicada',
                    'reservado', 'vendido', 'alquilado', 'baja'));
