-- Las captaciones tecleadas HOY quedaban marcadas al mediodía UTC (14:00 en
-- España). Como el listado ordena por esa fecha, se colocaban por encima de las
-- que iban llegando de los agentes esa mañana: el muro enterraba lo nuevo.
--
-- En las que se tecleó el mismo día que ocurrieron, la hora buena es la del
-- tecleo, que ya está en creada_en. Se corrigen solo esas: las que llevan la
-- marca del código viejo (12:00:00 UTC) y cuyo creada_en cae ese mismo día en
-- hora española. De una con fecha pasada no se sabe la hora y se deja igual:
-- es un día terminado, no puede adelantar a nada.
update fichas
   set recibida_en = creada_en
 where origen = 'oficina'
   and recibida_en::time = '12:00:00'
   and (creada_en at time zone 'Europe/Madrid')::date
     = (recibida_en at time zone 'Europe/Madrid')::date;
