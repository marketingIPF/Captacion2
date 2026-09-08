-- Quién teclea una captación en el panel.
--
-- No basta con `actualizada_por`: esa columna guarda la última persona que
-- tocó la ficha, así que la primera edición posterior borraría el rastro de
-- quién la creó. Y en el panel no entra solo una persona.
--
-- Se guardan las dos cosas: el correo, que es el dato que identifica de verdad,
-- y el nombre que traía su sesión de Google, para poder escribirlo sin tener
-- que adivinarlo a partir del correo más adelante.
alter table fichas add column if not exists creada_por text;
alter table fichas add column if not exists creada_por_nombre text;
