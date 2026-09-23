-- Destek paneli (destek.tahtaapp.com). soru-kontrol projesinde, d_ önekli tablolar.
-- Okuma: sadece d_yetkili listesindeki giriş yapmış kullanıcılar. Yazma: sadece RPC'ler (kararlar) ve Mac'teki servis anahtarı.
-- Panel admin.tahtaapp.com'a HİÇ bağlanmaz; panel sadece karar kaydeder, uygulamayı Mac yapar.

create table if not exists public.d_yetkili (
  email text primary key, ad text not null, rol text not null default 'uye',  -- yonetici | uye
  eklendi timestamptz not null default now()
);

create or replace function public.d_yetkili_mi() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.d_yetkili where email = lower(coalesce(auth.jwt()->>'email','')))
$$;

create table if not exists public.d_sikayet (
  key text primary key,                 -- s25347 / c1349898
  tur text not null,                    -- s (soru şikayeti) | c (cevap şikayeti)
  sikayet_id bigint not null, question_id bigint, tur_klasor text,
  ders text, ogretmen text, ogretmen_id bigint,
  sebep text, alt_sebep text[], ogrenci_notu text, yorumlar text[],
  soru_aciklamasi text, cevap_aciklamasi text, ses_dokumu text,
  soru_url text[] default '{}', cevap_url text[] default '{}', video_url text,
  ajan_karar text, hedef_ders text, hedef_lecture_id bigint, gerekce text,
  dogru_cevap text, ogretmen_cevabi text, emin_degil boolean default false,
  oneri text, oneri_gerekce text,
  durum text not null default 'islendi', -- islendi | bekliyor | hata
  son_karar text,                        -- panele işlenen son karar
  kontrol_hafta text,                    -- haftalık kontrol örneği ise '2026-W39'
  olusturma timestamptz not null default now(), guncelleme timestamptz not null default now()
);
create index if not exists d_sikayet_durum on public.d_sikayet(durum);
create index if not exists d_sikayet_hafta on public.d_sikayet(kontrol_hafta);
create index if not exists d_sikayet_ogr on public.d_sikayet(ogretmen_id);

create table if not exists public.d_karar (
  id bigserial primary key, key text not null references public.d_sikayet(key),
  tip text not null,                     -- bekleyen | kontrol
  secim text not null,                   -- ONAYLA|REDDET|HAVUZA_AKTAR  /  DOGRU|YANLIS
  notu text not null default '', kim text not null, zaman timestamptz not null default now(),
  uygulandi boolean not null default false, uygulama_notu text
);

create table if not exists public.d_ogretmen (
  id bigint primary key, ad text not null, durum text not null default 'aktif', -- aktif | pasif
  onay int not null default 0, ret int not null default 0, kategoriler jsonb not null default '{}',
  guncelleme timestamptz not null default now()
);

create table if not exists public.d_uyari (
  id bigserial primary key, ogretmen_id bigint not null, ad text not null,
  kademe text not null,                  -- F | Y | G | PASIF
  title text not null, description text not null, kanit text[] default '{}',
  durum text not null default 'taslak',  -- taslak | onaylandi | gonderildi | iptal | hata
  olusturma timestamptz not null default now(), karar_veren text, karar_zamani timestamptz,
  gonderim timestamptz, sonuc text
);
create index if not exists d_uyari_durum on public.d_uyari(durum);

create table if not exists public.d_tur (
  id bigserial primary key, klasor text unique, zaman timestamptz not null default now(),
  soru_n int default 0, cevap_n int default 0, onay int default 0, ret int default 0, havuz int default 0, bekleyen int default 0,
  ozet text
);

create table if not exists public.d_durum (k text primary key, v jsonb, zaman timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['d_yetkili','d_sikayet','d_karar','d_ogretmen','d_uyari','d_tur','d_durum'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists oku on public.%I', t);
    execute format('create policy oku on public.%I for select to authenticated using (public.d_yetkili_mi())', t);
  end loop;
end $$;

-- Kararlar sadece bu RPC'lerle yazılır (kim = giriş yapan e-posta)
create or replace function public.d_karar_ver(p_key text, p_tip text, p_secim text, p_not text default '')
returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_durum text;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  if p_tip not in ('bekleyen','kontrol') then raise exception 'tip'; end if;
  if p_tip='bekleyen' and p_secim not in ('ONAYLA','REDDET','HAVUZA_AKTAR') then raise exception 'secim'; end if;
  if p_tip='kontrol' and p_secim not in ('DOGRU','YANLIS') then raise exception 'secim'; end if;
  if p_tip='kontrol' and p_secim='YANLIS' and length(trim(coalesce(p_not,'')))<3 then raise exception 'not_gerekli'; end if;
  select durum into v_durum from public.d_sikayet where key=p_key;
  if v_durum is null then raise exception 'kayit_yok'; end if;
  if p_tip='bekleyen' and v_durum<>'bekliyor' then raise exception 'zaten_islendi'; end if;
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi;  -- fikir değiştirme
  insert into public.d_karar(key,tip,secim,notu,kim) values (p_key,p_tip,p_secim,coalesce(p_not,''),auth.jwt()->>'email') returning id into v_id;
  return v_id;
end $$;

create or replace function public.d_uyari_karar(p_id bigint, p_onay boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_uyari set durum = case when p_onay then 'onaylandi' else 'iptal' end,
         karar_veren = auth.jwt()->>'email', karar_zamani = now()
   where id=p_id and durum in ('taslak','onaylandi','iptal') and gonderim is null;
  if not found then raise exception 'degistirilemez'; end if;
end $$;

-- metni düzenleyip onaylama (sadece taslak)
create or replace function public.d_uyari_metin(p_id bigint, p_title text, p_description text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_uyari set title=p_title, description=p_description where id=p_id and durum='taslak';
  if not found then raise exception 'degistirilemez'; end if;
end $$;

revoke all on function public.d_karar_ver(text,text,text,text) from public, anon;
revoke all on function public.d_uyari_karar(bigint,boolean) from public, anon;
revoke all on function public.d_uyari_metin(bigint,text,text) from public, anon;
grant execute on function public.d_karar_ver(text,text,text,text) to authenticated;
grant execute on function public.d_uyari_karar(bigint,boolean) to authenticated;
grant execute on function public.d_uyari_metin(bigint,text,text) to authenticated;
