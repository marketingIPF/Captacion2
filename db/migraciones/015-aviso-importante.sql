-- Marca de "ojo con esta".
--
-- Lo pidió la oficina con un caso concreto: una agente avisa de que una
-- vivienda puede no venderse y de que ha pedido las fotos. Eso no es una fase
-- —la captación sigue su curso— ni cabe en la nota interna, que hay que abrir
-- la ficha para leer: es algo que tiene que verse en el listado, de un vistazo,
-- sin entrar.
--
-- Booleana y no un nivel de prioridad: si hay tres niveles, todo acaba siendo
-- urgente y la marca deja de significar nada.
alter table fichas add column if not exists importante boolean not null default false;

-- Quién la puso y cuándo, para poder preguntarle.
alter table fichas add column if not exists importante_por text;
alter table fichas add column if not exists importante_en timestamptz;
