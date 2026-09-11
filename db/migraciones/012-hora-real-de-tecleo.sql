-- Recupera la hora a la que se tecleó cada captación de oficina.
--
-- Al crearlas se ponía creada_en = la fecha elegida (al mediodía UTC), así que
-- se perdía el momento real. Ahora creada_en es ese momento, pero las que ya
-- existen lo tienen mal.
--
-- El dato se puede rescatar de actualizada_en, que un trigger pone a now() en
-- cada escritura: en una ficha que nadie ha vuelto a tocar sigue siendo la hora
-- del alta. Se corrigen SOLO las que aún llevan la marca del código viejo
-- —creada_en exactamente a las 12:00:00 UTC— y cuya actualizada_en es
-- posterior; en las demás no se sabe y se dejan como están.
update fichas
   set creada_en = actualizada_en
 where origen = 'oficina'
   and creada_en::time = '12:00:00'
   and actualizada_en > creada_en - interval '12 hours'
   and actualizada_en >= creada_en - interval '1 day';
