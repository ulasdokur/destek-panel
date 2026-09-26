-- Öğretmen itirazları (Tebeşir → destek paneli). Hazırlık: Tebeşir canlıya alınınca d_itiraz_ekle'yi çağıracak.
-- Tebeşir yalnız bu fonksiyonu, gizli itiraz anahtarıyla çağırabilir; tabloyu okuyamaz, başka hiçbir şeye dokunamaz.
create table if not exists public.d_itiraz (
  id bigserial primary key, zaman timestamptz not null default now(), kaynak text not null default 'tebesir',
  ogretmen_id bigint not null, question_id bigint, sikayet_key text, metin text not null,
  durum text not null default 'yeni',          -- yeni | incelendi
  karar text, karar_notu text, karar_kim text, karar_zamani timestamptz);   -- karar: HAKLI | HAKSIZ
create index if not exists d_itiraz_durum on public.d_itiraz(durum);
alter table public.d_itiraz enable row level security;
drop policy if exists d_itiraz_oku on public.d_itiraz;
create policy d_itiraz_oku on public.d_itiraz for select using (public.d_yetkili_mi());
revoke insert, update, delete, truncate on public.d_itiraz from anon, authenticated;

create table if not exists public.d_gizli (k text primary key, v text not null);   -- politikasız: yalnız security definer fonksiyonlar okur
alter table public.d_gizli enable row level security;
revoke all on public.d_gizli from anon, authenticated;

create or replace function public.d_itiraz_ekle(p_anahtar text, p_ogretmen_id bigint, p_metin text, p_question_id bigint default null, p_sikayet_no bigint default null)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_key text;
begin
  if p_anahtar is null or p_anahtar is distinct from (select v from public.d_gizli where k='itiraz_anahtari') then raise exception 'yetkisiz'; end if;
  if p_ogretmen_id is null or length(trim(coalesce(p_metin,'')))<5 then raise exception 'eksik'; end if;
  if (select count(*) from public.d_itiraz where ogretmen_id=p_ogretmen_id and zaman>now()-interval '1 day')>=5 then raise exception 'cok_fazla'; end if;
  if p_sikayet_no is not null then v_key := 'c'||p_sikayet_no;
  elsif p_question_id is not null then
    select key into v_key from public.d_sikayet where question_id=p_question_id and ogretmen_id=p_ogretmen_id and tur='c' order by olusturma desc limit 1;
  end if;
  insert into public.d_itiraz(ogretmen_id,question_id,sikayet_key,metin) values (p_ogretmen_id,p_question_id,v_key,left(p_metin,2000)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.d_itiraz_ekle(text,bigint,text,bigint,bigint) from public;
grant execute on function public.d_itiraz_ekle(text,bigint,text,bigint,bigint) to anon, authenticated;
