-- 1) Panel kararını Mac işlerken sahiplenir (isleniyor); işlenmekte olan karar geri alınamaz ve değiştirilemez.
--    Geri alma sunucu tarafında da 35 sn ile sınırlı (arayüzdeki 30 sn + pay); süre dolunca karar kesinleşir.
-- 2) İz kaydı: kararların, uyarı onaylarının ve metin değişikliklerinin kim/ne zaman/önce-sonra kaydı (d_olay).
-- 3) Çok kullanıcı: uyarı kararında beklenen durum kontrolü (başkasının kararını sessizce ezmesin).
-- 4) anon/authenticated tablolara doğrudan yazamaz (RLS zaten engelliyor; yetkiler de geri alınır).
alter table public.d_karar add column if not exists isleniyor timestamptz;

create table if not exists public.d_olay (
  id bigserial primary key, zaman timestamptz not null default now(), kim text, varlik text not null, varlik_id text not null,
  islem text not null, onceki jsonb, sonraki jsonb);
alter table public.d_olay enable row level security;
drop policy if exists d_olay_oku on public.d_olay;
create policy d_olay_oku on public.d_olay for select using (public.d_yetkili_mi());

create or replace function public.d_olay_yaz(p_varlik text, p_id text, p_islem text, p_onceki jsonb, p_sonraki jsonb)
returns void language sql security definer set search_path=public as $$
  insert into public.d_olay(kim,varlik,varlik_id,islem,onceki,sonraki) values (coalesce(auth.jwt()->>'email','mac'),p_varlik,p_id,p_islem,p_onceki,p_sonraki);
$$;
revoke all on function public.d_olay_yaz(text,text,text,jsonb,jsonb) from public, anon, authenticated;

create or replace function public.d_karar_ver(p_key text, p_tip text, p_secim text, p_not text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_durum text; v_tur text; v_hedef bigint; v_hafta text; v_eski jsonb;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  if p_tip not in ('bekleyen','kontrol') then raise exception 'tip'; end if;
  if p_tip='bekleyen' and p_secim not in ('ONAYLA','REDDET','HAVUZA_AKTAR') then raise exception 'secim'; end if;
  if p_tip='kontrol' and p_secim not in ('DOGRU','YANLIS') then raise exception 'secim'; end if;
  if p_tip='kontrol' and p_secim='YANLIS' and length(trim(coalesce(p_not,'')))<3 then raise exception 'not_gerekli'; end if;
  select durum, tur, hedef_lecture_id, kontrol_hafta into v_durum, v_tur, v_hedef, v_hafta from public.d_sikayet where key=p_key;
  if v_durum is null then raise exception 'kayit_yok'; end if;
  if p_tip='bekleyen' and v_durum<>'bekliyor' then raise exception 'zaten_islendi'; end if;
  if p_tip='kontrol' and v_hafta is null then raise exception 'kontrol_ornegi_degil'; end if;
  if p_secim='HAVUZA_AKTAR' and (v_tur<>'s' or v_hedef is null) then raise exception 'secim'; end if;
  if exists(select 1 from public.d_karar where key=p_key and tip=p_tip and not uygulandi and isleniyor is not null) then raise exception 'isleniyor'; end if;
  select to_jsonb(k) into v_eski from public.d_karar k where key=p_key and tip=p_tip and not uygulandi limit 1;
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi and isleniyor is null;  -- fikir değiştirme (işlenmeye başlamadıysa)
  insert into public.d_karar(key,tip,secim,notu,kim) values (p_key,p_tip,p_secim,coalesce(p_not,''),auth.jwt()->>'email') returning id into v_id;
  perform public.d_olay_yaz('karar',p_key,'karar_ver',v_eski,jsonb_build_object('tip',p_tip,'secim',p_secim,'notu',p_not));
  return v_id;
end $$;

create or replace function public.d_karar_geri_al(p_key text, p_tip text)
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi and isleniyor is null
     and zaman > now() - interval '35 seconds' and kim=auth.jwt()->>'email';
  get diagnostics n = row_count;
  if n=0 then raise exception 'geri_alinamaz'; end if;   -- süre doldu, işleniyor ya da başkasının kararı
  perform public.d_olay_yaz('karar',p_key,'geri_al',null,jsonb_build_object('tip',p_tip));
  return n;
end $$;

create or replace function public.d_uyari_karar(p_id bigint, p_onay boolean, p_beklenen text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_kademe text; v_durum text;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  select kademe, durum into v_kademe, v_durum from public.d_uyari where id=p_id;
  if v_kademe='PASIF' and p_onay and not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  if p_beklenen is not null and v_durum<>p_beklenen then raise exception 'degisti'; end if;   -- ekran bayat: başkası karar vermiş
  update public.d_uyari set durum = case when p_onay then 'onaylandi' else 'iptal' end,
         karar_veren = auth.jwt()->>'email', karar_zamani = now()
   where id=p_id and durum in ('taslak','onaylandi','iptal') and gonderim is null;
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_olay_yaz('uyari',p_id::text,case when p_onay then 'onayla' else 'gonderme' end,jsonb_build_object('durum',v_durum),null);
end $$;
revoke all on function public.d_uyari_karar(bigint,boolean,text) from public, anon;
grant execute on function public.d_uyari_karar(bigint,boolean,text) to authenticated;
drop function if exists public.d_uyari_karar(bigint,boolean);

create or replace function public.d_uyari_geri_al(p_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_uyari set durum='taslak', karar_veren=null, karar_zamani=null
   where id=p_id and durum in ('onaylandi','iptal') and gonderim is null;
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_olay_yaz('uyari',p_id::text,'geri_al',null,null);
end $$;

create or replace function public.d_uyari_metin(p_id bigint, p_title text, p_description text)
returns void language plpgsql security definer set search_path=public as $$
declare v_eski jsonb;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  select jsonb_build_object('title',title,'description',description) into v_eski from public.d_uyari where id=p_id and durum='taslak';
  update public.d_uyari set title=p_title, description=p_description where id=p_id and durum='taslak';
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_olay_yaz('uyari',p_id::text,'metin',v_eski,jsonb_build_object('title',p_title,'description',p_description));
end $$;

create or replace function public.d_basvuru_kontrol(p_id bigint, p_secim text, p_not text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  if p_secim not in ('DOGRU','YANLIS') then raise exception 'secim'; end if;
  if p_secim='YANLIS' and length(trim(coalesce(p_not,'')))<3 then raise exception 'not_gerekli'; end if;
  update public.d_basvuru set kontrol_secim=p_secim, kontrol_not=coalesce(p_not,''), kontrol_kim=auth.jwt()->>'email', kontrol_zamani=now()
   where id=p_id and kontrol_hafta is not null and kontrol_secim is null;   -- yalnız kontrol örneği, bir kez
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_olay_yaz('basvuru',p_id::text,'kontrol',null,jsonb_build_object('secim',p_secim,'not',p_not));
end $$;

do $$ declare t text; begin
  foreach t in array array['d_yetkili','d_sikayet','d_karar','d_ogretmen','d_uyari','d_tur','d_durum','d_basvuru','d_takip','d_izlenen','d_solver_puan','d_olay'] loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop; end $$;
