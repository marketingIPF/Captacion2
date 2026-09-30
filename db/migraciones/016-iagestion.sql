-- Envío de la ficha a IA Gestión.
--
-- La subida la dispara una persona de la oficina desde el panel (nunca es
-- automática: escribe en inmuebles reales). Aquí queda constancia de la última:
-- cuándo, quién y qué pasó, para no tener que abrir IA Gestión a comprobarlo.
alter table fichas add column if not exists iagestion_estado    text
  check (iagestion_estado in ('subida', 'error'));
alter table fichas add column if not exists iagestion_en        timestamptz;
alter table fichas add column if not exists iagestion_por       text;
-- { ok, ref, inmueble, aplicados[], noGuardados[], avisos[], error }
alter table fichas add column if not exists iagestion_resultado jsonb;
