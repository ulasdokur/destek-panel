-- 30 Eki (Ulaş): bizim cevapların kalite incelemesi. İki kaynak:
--   ornek  : her gün sonunda o günkü yapay zekâ cevaplarından branş ağırlığına göre örneklem (ai_ornek.py yazar)
--   sikayet: bizim hesaplara (AI + banka) gelen cevap şikayetleri — öğretmene bildirim yok, öğretmen biziz; amaç "çözüm nerede kötüydü"
-- Ulaş beğendim / beğenmedim + kusur + not verir; notlar kalite/dongu.py'nin aday kurallarına girer.
create table if not exists public.d_ai_inceleme (
  key text primary key,                 -- 'o:2026-10-30:1395991' ya da 's:1419720'
  tur text not null check (tur in ('ornek', 'sikayet')),
  gun date not null,
  soru_id bigint not null,
  ders text, hesap text, cevap text,
  soru_foto jsonb, cevap_foto jsonb,
  ogrenci_notu text, deg text,
  karar text check (karar in ('begendim', 'begenmedim')),
  kusurlar text[] not null default '{}',
  notu text, inceleyen text, karar_zamani timestamptz,
  olusturma timestamptz not null default now()
);
create index if not exists d_ai_inceleme_gun on public.d_ai_inceleme(gun desc, tur);
alter table public.d_ai_inceleme enable row level security;
drop policy if exists d_ai_inceleme_oku on public.d_ai_inceleme;
create policy d_ai_inceleme_oku on public.d_ai_inceleme for select using (public.d_yonetici_mi());

create or replace function public.d_ai_inceleme_karar(p_key text, p_karar text, p_kusurlar text[], p_not text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yonetici_mi() then raise exception 'yetkisiz'; end if;
  update public.d_ai_inceleme set karar = nullif(p_karar, ''), kusurlar = coalesce(p_kusurlar, '{}'), notu = nullif(p_not, ''),
    inceleyen = lower(auth.jwt() ->> 'email'), karar_zamani = now() where key = p_key;
end $$;
revoke all on function public.d_ai_inceleme_karar(text, text, text[], text) from public;
grant execute on function public.d_ai_inceleme_karar(text, text, text[], text) to authenticated;
