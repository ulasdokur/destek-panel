-- Mac'teki tur logları kalıcı olarak burada tutulur (yerel kopya 30 günde silinir). Günde ~60 KB.
create table if not exists public.d_log (
  dosya text not null, satir_no int not null, gun date not null, metin text not null,
  primary key (dosya, satir_no));
create index if not exists d_log_gun on public.d_log(gun);
alter table public.d_log enable row level security;
drop policy if exists d_log_oku on public.d_log;
create policy d_log_oku on public.d_log for select using (public.d_yetkili_mi());
revoke insert, update, delete, truncate on public.d_log from anon, authenticated;
