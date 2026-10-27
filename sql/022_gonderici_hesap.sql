-- 27 Eki: yapay zekâ cevabını hangi hesabın gönderdiği (Berfin/Serkan/Elif/Mert/Umut). Banka cevaplarında boş.
-- Panelde üst şeritteki hesap çipine tıklayınca o hesabın cevapları listelenir.
alter table public.d_gonderici_cevap add column if not exists hesap text;
create index if not exists d_gonderici_cevap_hesap on public.d_gonderici_cevap(hesap, zaman desc);
