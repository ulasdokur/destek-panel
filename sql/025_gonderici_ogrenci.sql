-- 30 Eki (Ulaş): AI/banka cevaplarında öğrenci başına yeterli/yetersiz oranı için öğrenci kimliği (panel_senk soru kaydının user.id'si)
alter table d_gonderici_cevap add column if not exists ogrenci_id bigint;
create index if not exists d_gonderici_cevap_ogrenci_idx on d_gonderici_cevap (ogrenci_id);
