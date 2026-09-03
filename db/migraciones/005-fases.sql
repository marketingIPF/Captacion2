-- Los estados pasan a ser las fases reales del proceso de la agencia:
--   nueva → agendada_fotos → pendiente → publicada
-- y "baja" como salida (la captación no vale).
--
-- El anterior "descartada" es exactamente eso, así que se convierte en "baja".

begin;

alter table fichas drop constraint if exists fichas_estado_check;

update fichas set estado = 'baja' where estado = 'descartada';

alter table fichas add constraint fichas_estado_check
  check (estado in ('nueva', 'agendada_fotos', 'pendiente', 'publicada', 'baja'));

commit;
