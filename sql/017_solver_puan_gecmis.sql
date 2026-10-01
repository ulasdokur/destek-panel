-- Solver puan geçmişi (1 Eki 2026): puan her değiştiğinde bir satır. fark = dogru − 3×sikayet + diger.
-- diger: admin panelde görünmeyen düşüşler (soruyu bırakma, süre aşımı vb.) ya da elle düzeltme; hesaplanamadıysa null.
create table if not exists public.d_solver_puan_gecmis (
  id bigserial primary key, solver_id bigint not null, zaman timestamptz not null default now(),
  puan numeric not null, onceki numeric, fark numeric, dogru int, sikayet int, diger numeric, kaynak text not null default 'okuma'
);
create index if not exists d_solver_puan_gecmis_s on public.d_solver_puan_gecmis(solver_id, zaman desc);
alter table public.d_solver_puan_gecmis enable row level security;
drop policy if exists oku on public.d_solver_puan_gecmis;
create policy oku on public.d_solver_puan_gecmis for select to authenticated using (public.d_yetkili_mi());
revoke insert, update, delete, truncate on public.d_solver_puan_gecmis from anon, authenticated;
