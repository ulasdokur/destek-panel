-- 13 Kas 2026: Tebeşir artımlı çekimi (guncelleme > esik order by guncelleme, soru_id) index'siz
-- her istekte tabloyu baştan sıralayıp diske geçici dosya yazıyordu (17 GB temp, Disk IO Budget uyarısı).
-- Canlıya Management API ile uygulandı.
create index if not exists d_gonderici_cevap_guncelleme on public.d_gonderici_cevap (guncelleme, soru_id);
