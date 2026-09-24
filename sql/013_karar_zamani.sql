alter table public.d_sikayet add column if not exists karar_zamani timestamptz;  -- panelde verilen kararın uygulandığı an (geri bildirim günü)
