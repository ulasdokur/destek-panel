-- Öğretmene giden geri bildirim cümlesi ve tartışmalı karar işareti (tartışmalılar geri bildirime girmez).
alter table public.d_sikayet add column if not exists ogretmene text;
alter table public.d_sikayet add column if not exists tartismali boolean not null default false;
alter table public.d_takip add column if not exists ogretmene text;
alter table public.d_takip add column if not exists tartismali boolean not null default false;
