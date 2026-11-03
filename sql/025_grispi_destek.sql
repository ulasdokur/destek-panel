-- 3 Kas 2026 (Ulaş): Grispi Destek bölümü. Dilara Grispi oturumu (Mac mini, tahtabeast) yazar.
--   d_cs_soru : oturumun müşteriye cevap veremediği sorular. Dilara ya da Ulaş cevabı panelden yazar,
--               oturum cevabı okuyup müşteriye iletir (durum: bekliyor → cevaplandi → iletildi).
--   d_cs_rapor: her gün 22:00 gün sonu raporu (sayılar + botun yanlışları + bilinmeyenler + sorunlar).
-- Okuma: d_yetkili (yönetici + destek). Yazma: yalnız RPC (cevap) ve oturumdaki servis anahtarı.
-- Panelde müşteri telefonu GÖSTERİLMEZ; ticket no + ad yeter.

create table if not exists public.d_cs_soru (
  id bigserial primary key,
  ticket text not null,                 -- TICKET-60947
  musteri text,                         -- ad (telefon yok)
  soru text not null,                   -- müşterinin sorusu (sade özet)
  bilinmeyen text,                      -- oturumun neyi bilmediği / neden soruyor
  oneri text,                           -- oturumun taslak cevabı (varsa)
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'cevaplandi', 'iletildi', 'iptal')),
  cevap text, cevaplayan text, cevap_zamani timestamptz,
  iletilen text, iletildi_zamani timestamptz,
  olusturma timestamptz not null default now()
);
create index if not exists d_cs_soru_durum on public.d_cs_soru(durum, olusturma desc);

create table if not exists public.d_cs_rapor (
  gun date primary key,
  sayilar jsonb not null default '{}',  -- {konusulan, cozulen, bekleyen, satisa, dilaraya, kilit_acilan, ...}
  bot_hatalari jsonb not null default '[]',   -- [{ticket, ne_oldu, dogrusu}]
  bilinmeyenler jsonb not null default '[]',  -- [{ticket, konu}]
  sorunlar jsonb not null default '[]',       -- [{baslik, ayrinti}]
  notlar text,
  olusturma timestamptz not null default now()
);

alter table public.d_cs_soru enable row level security;
alter table public.d_cs_rapor enable row level security;
drop policy if exists d_cs_soru_oku on public.d_cs_soru;
create policy d_cs_soru_oku on public.d_cs_soru for select using (public.d_yetkili_mi());
drop policy if exists d_cs_rapor_oku on public.d_cs_rapor;
create policy d_cs_rapor_oku on public.d_cs_rapor for select using (public.d_yetkili_mi());
revoke insert, update, delete, truncate on public.d_cs_soru from anon, authenticated;
revoke insert, update, delete, truncate on public.d_cs_rapor from anon, authenticated;

-- Cevap yaz / düzelt (iletilmeden önce). Boş cevap → geri 'bekliyor'.
create or replace function public.d_cs_cevapla(p_id bigint, p_cevap text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_cs_soru set
    cevap = nullif(trim(coalesce(p_cevap, '')), ''),
    durum = case when nullif(trim(coalesce(p_cevap, '')), '') is null then 'bekliyor' else 'cevaplandi' end,
    cevaplayan = lower(auth.jwt() ->> 'email'), cevap_zamani = now()
  where id = p_id and durum in ('bekliyor', 'cevaplandi');
  if not found then raise exception 'degistirilemez'; end if;
end $$;
revoke all on function public.d_cs_cevapla(bigint, text) from public, anon;
grant execute on function public.d_cs_cevapla(bigint, text) to authenticated;
