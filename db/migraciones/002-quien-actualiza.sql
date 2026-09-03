-- Con el panel autenticado por persona (Neon Auth + Google) ya se puede saber
-- quién tocó cada ficha. Antes, con un PIN compartido, no había forma.
alter table fichas add column if not exists actualizada_por text;
