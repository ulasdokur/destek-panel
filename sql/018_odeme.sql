-- Uzaklaştırılan solverların kalan bakiyesinin ödenmesi. Destek hattı ödeme bilgisini alır, sakıncalı cevapların kazancı düşülür,
-- kalan tutar ay sonu ödemesiyle gönderilir. Kimlik ve hesap bilgisi içerdiği için tabloyu yalnız yöneticiler okur.
create table if not exists public.d_odeme (
  id bigserial primary key,
  ogretmen_id bigint not null unique, ad text not null, telefon text,
  sebep text,                                  -- uzaklaştırma nedeni (yapay zekâ, yetersiz çözüm, başkasının cevabı...)
  pasif_tarihi date,
  bakiye numeric(10,2),                        -- uzaklaştırıldığı andaki bakiye
  kesinti numeric(10,2),                       -- sakıncalı cevapların kazancı; null = henüz hesaplanmadı
  kesinti_notu text,
  odenecek numeric(10,2),                      -- bakiye - kesinti; null = henüz belli değil
  hesap_sahibi text, iban text, tc text, il text,
  durum text not null default 'bilgi_bekleniyor' check (durum in ('bilgi_bekleniyor','odenecek','odendi')),
  odeme_zamani timestamptz, odeyen text, notu text,
  olusturma timestamptz not null default now(), guncelleme timestamptz not null default now());
create index if not exists d_odeme_durum on public.d_odeme(durum);
alter table public.d_odeme enable row level security;
drop policy if exists d_odeme_oku on public.d_odeme;
create policy d_odeme_oku on public.d_odeme for select using (public.d_yonetici_mi());
revoke insert, update, delete, truncate on public.d_odeme from anon, authenticated;

-- Ödendi işaretleme ve geri alma; yalnız yönetici. Ödenecek tutarı ve hesap bilgisi olmayan kayıt ödendi yapılamaz.
create or replace function public.d_odeme_isaretle(p_id bigint, p_odendi boolean, p_not text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v public.d_odeme;
begin
  if not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  select * into v from public.d_odeme where id=p_id;
  if not found then raise exception 'bulunamadi'; end if;
  if p_odendi then
    if v.odenecek is null or coalesce(v.iban,'')='' then raise exception 'eksik_bilgi'; end if;
    update public.d_odeme set durum='odendi', odeme_zamani=now(), odeyen=auth.jwt()->>'email',
           notu=coalesce(nullif(trim(p_not),''), notu), guncelleme=now() where id=p_id;
  else
    update public.d_odeme set durum='odenecek', odeme_zamani=null, odeyen=null, guncelleme=now() where id=p_id and durum='odendi';
  end if;
end $$;
revoke all on function public.d_odeme_isaretle(bigint,boolean,text) from public, anon;
grant execute on function public.d_odeme_isaretle(bigint,boolean,text) to authenticated;
