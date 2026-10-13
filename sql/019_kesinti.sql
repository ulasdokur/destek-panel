-- Kapatılmış hesap kesintisi. Sunucu (kesinti.py) hesabı kapalı ve bakiyesi duran öğretmenin son çekim talebinden sonraki
-- cevaplarını inceler, her cevabı d_kesinti_cevap'a, özetini d_kesinti'ye yazar. Panelde onaylanınca sunucu kesintiyi admin
-- panelde bakiyeden düşer ve kalanı d_odeme'ye yazar. Tabloları yalnız yöneticiler okur; yazma yalnız RPC ile.
create table if not exists public.d_kesinti (
  ogretmen_id bigint primary key, ad text not null, telefon text,
  pasif_tarihi date,
  son_cekim timestamp,                         -- son onaylı çekim talebi (yerel saat); null = hiç çekim yok, bütün cevaplar
  bakiye numeric(10,2),                        -- inceleme anındaki bakiye
  cevap_sayisi int not null default 0,         -- son çekimden sonraki cevap
  incelenen int not null default 0,            -- bunlardan ücreti kesilebilecek (sistemin otomatik değerlendirdiği, kazanç getirmiş) ve incelenmiş olanlar
  hesap_paylasimi boolean not null default false,   -- cevapları başkası yazmış: bakiyenin tamamı silinir
  kesinti numeric(10,2), odenecek numeric(10,2),
  durum text not null default 'inceleniyor' check (durum in ('inceleniyor','hazir','onaylandi','uygulandi','sorun','acik_hesap','bakiye_yok')),
  durum_notu text,                             -- panelde gösterilen sade açıklama
  onaylayan text, onay_zamani timestamptz, isleniyor timestamptz,
  bakiye_sonra numeric(10,2), uygulama_zamani timestamptz,
  olusturma timestamptz not null default now(), guncelleme timestamptz not null default now());
create table if not exists public.d_kesinti_cevap (
  id bigserial primary key,
  ogretmen_id bigint not null references public.d_kesinti(ogretmen_id) on delete cascade,
  question_id bigint not null, cevap_tarihi timestamp, ders text,
  tutar numeric(10,2) not null default 0,      -- bu cevabın kazancı
  degerlendiren text,                          -- 'otomatik' | 'ogrenci' | null (henüz değerlendirilmemiş)
  sonuc text,                                  -- 'YZ' hazır metin / yapay zekâ · 'KENDI' kendi çözümü · null incelenmedi
  gerekce text, cevap_metni text,
  soru_url jsonb not null default '[]', cevap_url jsonb not null default '[]', video_url text,
  kesilsin boolean not null default false,
  unique (ogretmen_id, question_id));
create index if not exists d_kesinti_cevap_ogretmen on public.d_kesinti_cevap(ogretmen_id);
alter table public.d_kesinti enable row level security;
alter table public.d_kesinti_cevap enable row level security;
drop policy if exists d_kesinti_oku on public.d_kesinti;
create policy d_kesinti_oku on public.d_kesinti for select using (public.d_yonetici_mi());
drop policy if exists d_kesinti_cevap_oku on public.d_kesinti_cevap;
create policy d_kesinti_cevap_oku on public.d_kesinti_cevap for select using (public.d_yonetici_mi());
revoke insert, update, delete, truncate on public.d_kesinti, public.d_kesinti_cevap from anon, authenticated;

-- Kesinti = işaretli cevapların kazancı (bakiyeyi aşamaz); hesap paylaşımında bakiyenin tamamı.
create or replace function public.d_kesinti_hesapla(p_ogretmen bigint) returns void language sql security definer set search_path=public as $$
  update public.d_kesinti k set
    kesinti = case when k.hesap_paylasimi then k.bakiye
                   else least(k.bakiye, coalesce((select sum(c.tutar) from public.d_kesinti_cevap c where c.ogretmen_id=k.ogretmen_id and c.kesilsin),0)) end,
    guncelleme = now()
  where k.ogretmen_id=p_ogretmen;
  update public.d_kesinti set odenecek = bakiye - kesinti where ogretmen_id=p_ogretmen;
$$;
revoke all on function public.d_kesinti_hesapla(bigint) from public, anon, authenticated;

-- Tek cevabı kesintiye ekle / kesintiden çıkar. Yalnız sistemin otomatik değerlendirdiği, kazanç getirmiş cevap kesilebilir.
create or replace function public.d_kesinti_isaretle(p_cevap bigint, p_kesilsin boolean) returns void language plpgsql security definer set search_path=public as $$
declare c public.d_kesinti_cevap;
begin
  if not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  select * into c from public.d_kesinti_cevap where id=p_cevap;
  if not found then raise exception 'bulunamadi'; end if;
  if not exists (select 1 from public.d_kesinti where ogretmen_id=c.ogretmen_id and durum='hazir') then raise exception 'degistirilemez'; end if;
  if p_kesilsin and (c.degerlendiren is distinct from 'otomatik' or c.tutar<=0) then raise exception 'kesilemez'; end if;
  update public.d_kesinti_cevap set kesilsin=p_kesilsin where id=p_cevap;
  perform public.d_kesinti_hesapla(c.ogretmen_id);
end $$;

create or replace function public.d_kesinti_paylasim(p_ogretmen bigint, p_var boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  update public.d_kesinti set hesap_paylasimi=p_var where ogretmen_id=p_ogretmen and durum='hazir';
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_kesinti_hesapla(p_ogretmen);
end $$;

-- Onay: sunucu geri al süresi dolunca işler. Geri alma yalnız sunucu işlemeye başlamadan.
create or replace function public.d_kesinti_onayla(p_ogretmen bigint, p_onay boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  if p_onay then
    perform public.d_kesinti_hesapla(p_ogretmen);
    update public.d_kesinti set durum='onaylandi', onaylayan=auth.jwt()->>'email', onay_zamani=now(), guncelleme=now()
      where ogretmen_id=p_ogretmen and durum='hazir' and kesinti is not null;
  else
    update public.d_kesinti set durum='hazir', onaylayan=null, onay_zamani=null, guncelleme=now()
      where ogretmen_id=p_ogretmen and durum='onaylandi' and isleniyor is null;
  end if;
  if not found then raise exception 'degistirilemez'; end if;
end $$;
revoke all on function public.d_kesinti_isaretle(bigint,boolean), public.d_kesinti_paylasim(bigint,boolean), public.d_kesinti_onayla(bigint,boolean) from public, anon;
grant execute on function public.d_kesinti_isaretle(bigint,boolean), public.d_kesinti_paylasim(bigint,boolean), public.d_kesinti_onayla(bigint,boolean) to authenticated;
