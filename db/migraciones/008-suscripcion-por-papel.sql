-- Un navegador puede tener más de un papel.
--
-- La tabla tenía el endpoint como clave primaria, o sea una fila por navegador.
-- Parecía razonable —un navegador, una persona— pero no lo es: desde el mismo
-- Chrome se usa el panel de oficina Y la app de agente. Al activar el botón en
-- el segundo, el ON CONFLICT (endpoint) convertía la suscripción de oficina en
-- una de agente, sin avisar, y la oficina dejaba de recibir captaciones nuevas.
--
-- La clave pasa a ser (endpoint, tipo): el mismo navegador puede estar suscrito
-- como oficina y como agente a la vez. Dentro de un tipo se sigue sustituyendo,
-- que es lo correcto: cambiar de agente en el mismo móvil no debe dejar activas
-- las notificaciones del anterior.
alter table suscripciones_push drop constraint if exists suscripciones_push_pkey;
alter table suscripciones_push add primary key (endpoint, tipo);
