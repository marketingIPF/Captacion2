-- Se descarta el índice único sobre la referencia interna.
--
-- La asigna el agente al captar, y puede hacerlo sin cobertura, así que dos
-- agentes pueden acabar poniendo el mismo número sin saberlo. Con un índice
-- único, ese choque haría fallar el guardado de la ficha COMPLETA: el agente
-- perdería la captación por un conflicto de numeración. Preferimos aceptar el
-- duplicado y que la oficina lo resuelva.
drop index if exists fichas_referencia_unica;
