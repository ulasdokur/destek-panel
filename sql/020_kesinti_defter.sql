-- Uygulanan kesintinin 0850 işlem defterine (Mac, DEFTER.csv) aktarılıp aktarılmadığı; araclar/kesinti_defter.py işaretler.
alter table public.d_kesinti add column if not exists deftere_islendi boolean not null default false;
update public.d_kesinti set deftere_islendi=true where ogretmen_id=41621;   -- 13 Eki denemesi deftere elle yazıldı
