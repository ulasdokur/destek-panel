-- Cevap Gönderici izleme. Mac'teki ~/tahta-coz/banka/panel_senk.py (launchd, 5 dk) göndericinin yerel kayıtlarını okur,
-- gönderilen her cevabı d_gonderici_cevap'a, günlük/ders/sebep/sağlık özetlerini d_gonderici_ozet'e yazar.
-- Panel yalnız okur (yalnız yöneticiler); yazma servis anahtarıyla Mac'ten.
create table if not exists public.d_gonderici_cevap (
  soru_id bigint primary key,
  zaman timestamp not null,                    -- gönderim (yerel saat)
  ders text,                                   -- admin'deki ders adı, ör. "TYT Matematik (Mezun)"
  video boolean not null default false,
  benzerlik numeric(5,3),
  soru_foto jsonb not null default '[]',       -- öğrencinin soru fotoğrafları
  cevap_foto jsonb not null default '[]',      -- gönderilen banka cevabı (fotoğraflar ya da tek video)
  banka_id bigint, sik text, unite text, konu text,
  deg text not null default 'bekliyor' check (deg in ('bekliyor','yeterli','yetersiz','otomatik','degerlendirilmedi')),
  deg_metin text, deg_zaman timestamp,
  kazanc numeric(8,2),                         -- değerlendirmede yazan gerçek kazanç
  yorumlar jsonb not null default '[]',        -- [{kim:'ogrenci'|'biz', metin, zaman}]
  guncelleme timestamptz not null default now());
create index if not exists d_gonderici_cevap_zaman on public.d_gonderici_cevap(zaman desc);
create table if not exists public.d_gonderici_ozet (k text primary key, v jsonb, zaman timestamptz not null default now());
alter table public.d_gonderici_cevap enable row level security;
alter table public.d_gonderici_ozet enable row level security;
drop policy if exists d_gonderici_cevap_oku on public.d_gonderici_cevap;
create policy d_gonderici_cevap_oku on public.d_gonderici_cevap for select using (public.d_yonetici_mi());
drop policy if exists d_gonderici_ozet_oku on public.d_gonderici_ozet;
create policy d_gonderici_ozet_oku on public.d_gonderici_ozet for select using (public.d_yonetici_mi());
revoke insert, update, delete, truncate on public.d_gonderici_cevap, public.d_gonderici_ozet from anon, authenticated;
