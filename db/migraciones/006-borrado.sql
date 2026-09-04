-- Borrado de captaciones desde el panel.
--
-- Es un borrado reversible, no un DELETE: al borrarla, la ficha desaparece
-- también del historial del agente en su móvil. Si la oficina se equivoca, un
-- DELETE se habría llevado por delante el único registro que quedaba. Con una
-- marca, deshacerlo es un UPDATE.
alter table fichas add column if not exists eliminada_en  timestamptz;
alter table fichas add column if not exists eliminada_por text;

-- El listado solo mira las vivas: el índice las cubre sin arrastrar el resto.
create index if not exists fichas_vivas_idx
  on fichas (coalesce(corregida_en, recibida_en) desc)
  where eliminada_en is null;
