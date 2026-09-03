-- Elimina el estado "en_curso": la oficina solo usa Nueva, Publicada y Descartada.
-- Las fichas que estuvieran en curso vuelven a "nueva", que es el estado de
-- trabajo pendiente. Seguro de ejecutar más de una vez.

begin;

alter table fichas drop constraint if exists fichas_estado_check;

update fichas set estado = 'nueva' where estado = 'en_curso';

alter table fichas add constraint fichas_estado_check
  check (estado in ('nueva', 'publicada', 'descartada'));

commit;
