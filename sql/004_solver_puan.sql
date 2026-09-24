-- Eksi puan takibi: aktif solverların puanı saatlik okunur; eksiye düşene otomatik bildirim (Ulaş onayı 24 Eyl)
create table if not exists public.d_solver_puan (
  id bigint primary key, ad text, seo text, puan numeric, onceki_puan numeric,
  son_okuma timestamptz, eksiye_dustu timestamptz, bildirim_zamani timestamptz, son_3gun_cevap int
);
alter table public.d_solver_puan enable row level security;
drop policy if exists oku on public.d_solver_puan;
create policy oku on public.d_solver_puan for select to authenticated using (public.d_yetkili_mi());
