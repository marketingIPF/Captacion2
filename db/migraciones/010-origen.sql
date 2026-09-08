-- De dónde sale cada captación.
--
-- La oficina puede teclear a mano las de antes de que existiera la app, y esas
-- vienen incompletas a propósito: puede faltar el propietario, el tipo o media
-- dirección. Sin esta columna, una ficha a medias parece un fallo de la app o
-- un agente que no rellenó, y nadie puede saber que estaba así de origen.
--
-- Por defecto 'agente', que es lo que eran todas las que ya había.
alter table fichas
  add column if not exists origen text not null default 'agente'
  check (origen in ('agente', 'oficina'));
