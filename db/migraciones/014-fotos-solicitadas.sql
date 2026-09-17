-- Una fase más antes de agendar las fotos.
--
-- El proceso real tiene dos pasos donde había uno: primero el agente SOLICITA
-- las fotos y después se AGENDAN. Con una sola fase no se distinguía una
-- captación esperando a que la oficina reaccione de otra que ya tiene día.
--
-- La clave agendada_fotos se mantiene: solo cambia su etiqueta, que pasa de
-- "Agendada para fotos" a "Fotos agendadas". Renombrar la clave obligaría a
-- migrar las filas existentes sin ganar nada.
alter table fichas drop constraint if exists fichas_estado_check;

alter table fichas add constraint fichas_estado_check
  check (estado in ('nueva', 'fotos_solicitadas', 'agendada_fotos', 'pendiente',
                    'publicada', 'reservado', 'vendido', 'alquilado', 'baja'));
