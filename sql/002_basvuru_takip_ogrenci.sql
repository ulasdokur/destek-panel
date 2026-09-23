-- Solver başvuruları, affedilen öğretmenlerin yakın takibi, şikayet eden öğrenci
alter table public.d_sikayet add column if not exists ogrenci text, add column if not exists ogrenci_id bigint;
create index if not exists d_sikayet_ogrenci on public.d_sikayet(ogrenci_id);

create table if not exists public.d_basvuru (
  id bigint primary key, user_id bigint, ad text, seo text, ders text, basvuru_tarihi text,
  karar text, sebep_id int, sebep text, gerekce text, emin_degil boolean default false,
  sorular jsonb not null default '[]',   -- [{no, soru_url, cevap_url[], dogru_cevap, aday_cevap, dogru_mu, format_uygun, not}]
  durum text not null default 'islendi', -- islendi | bekliyor | hata
  islem_zamani timestamptz, kontrol_hafta text,
  kontrol_secim text, kontrol_not text, kontrol_kim text, kontrol_zamani timestamptz,
  olusturma timestamptz not null default now()
);

create table if not exists public.d_takip (
  key text primary key,                  -- <ogretmen_id>_<question_id>
  ogretmen_id bigint not null, ogretmen text, question_id bigint, ders text, cevap_tarihi timestamptz,
  soru_url text[] default '{}', cevap_url text[] default '{}', video_url text,
  sonuc text,                            -- TEMIZ | SORUNLU | YZ_KESIN
  kategori text[] default '{}', gerekce text, olusturma timestamptz not null default now()
);
create index if not exists d_takip_ogr on public.d_takip(ogretmen_id);

create table if not exists public.d_izlenen (
  ogretmen_id bigint primary key, ad text, sebep text, baslangic timestamptz not null default now(), bitis timestamptz,
  ekleyen text
);

do $$ declare t text; begin
  foreach t in array array['d_basvuru','d_takip','d_izlenen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists oku on public.%I', t);
    execute format('create policy oku on public.%I for select to authenticated using (public.d_yetkili_mi())', t);
  end loop;
end $$;

create or replace function public.d_basvuru_kontrol(p_id bigint, p_secim text, p_not text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  if p_secim not in ('DOGRU','YANLIS') then raise exception 'secim'; end if;
  if p_secim='YANLIS' and length(trim(coalesce(p_not,'')))<3 then raise exception 'not_gerekli'; end if;
  update public.d_basvuru set kontrol_secim=p_secim, kontrol_not=coalesce(p_not,''), kontrol_kim=auth.jwt()->>'email', kontrol_zamani=now() where id=p_id;
  if not found then raise exception 'kayit_yok'; end if;
end $$;
revoke all on function public.d_basvuru_kontrol(bigint,text,text) from public, anon;
grant execute on function public.d_basvuru_kontrol(bigint,text,text) to authenticated;
