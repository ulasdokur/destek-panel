-- 30 Eki (Ulaş): "yetersiz dedi şikayet açmadı" cevaplar da inceleme kuyruğuna düşer (tur = yetersiz).
alter table public.d_ai_inceleme drop constraint if exists d_ai_inceleme_tur_check;
alter table public.d_ai_inceleme add constraint d_ai_inceleme_tur_check check (tur in ('ornek', 'sikayet', 'yetersiz'));
