-- 1) Ajanın emin olamadığı solver başvuruları panelde insan kararına düşer (durum 'bekliyor').
--    Karar 30 sn geri alınabilir (sunucuda 35 sn); Mac işlerken sahiplenir (isleniyor), sonra admin paneline işler.
-- 2) "Şikayet reddedildi ama öğretmen uyarılsın": küçük sorunlar (kucuk_sorun) birikir, eşik dolunca öğretmene hatırlatma taslağı açılır.
alter table public.d_basvuru add column if not exists oneri text, add column if not exists oneri_gerekce text,
  add column if not exists insan_karar text, add column if not exists insan_sebep_id int, add column if not exists insan_not text,
  add column if not exists insan_kim text, add column if not exists insan_zaman timestamptz, add column if not exists isleniyor timestamptz,
  add column if not exists uygulama_notu text;
alter table public.d_sikayet add column if not exists kucuk_sorun text;
alter table public.d_takip add column if not exists kucuk_sorun text;
alter table public.d_karar add column if not exists kucuk_sorun text;

create or replace function public.d_basvuru_karar(p_id bigint, p_secim text, p_sebep_id int default null, p_not text default '')
returns void language plpgsql security definer set search_path=public as $$
declare v_eski jsonb;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  if p_secim not in ('ONAYLA','REDDET') then raise exception 'secim'; end if;
  if p_secim='REDDET' and (p_sebep_id is null or p_sebep_id not between 1 and 9) then raise exception 'sebep_gerekli'; end if;
  select jsonb_build_object('insan_karar',insan_karar,'insan_sebep_id',insan_sebep_id) into v_eski from public.d_basvuru where id=p_id;
  update public.d_basvuru set insan_karar=p_secim, insan_sebep_id=case when p_secim='REDDET' then p_sebep_id end, insan_not=coalesce(p_not,''),
         insan_kim=auth.jwt()->>'email', insan_zaman=now(), uygulama_notu=null
   where id=p_id and durum='bekliyor' and isleniyor is null;
  if not found then raise exception 'degistirilemez'; end if;
  perform public.d_olay_yaz('basvuru',p_id::text,'karar',v_eski,jsonb_build_object('secim',p_secim,'sebep_id',p_sebep_id,'not',p_not));
end $$;

create or replace function public.d_basvuru_karar_geri_al(p_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_basvuru set insan_karar=null, insan_sebep_id=null, insan_not=null, insan_kim=null, insan_zaman=null
   where id=p_id and durum='bekliyor' and isleniyor is null and insan_zaman > now() - interval '35 seconds' and insan_kim=auth.jwt()->>'email';
  if not found then raise exception 'geri_alinamaz'; end if;
  perform public.d_olay_yaz('basvuru',p_id::text,'geri_al',null,null);
end $$;

-- d_karar_ver: panelde "Reddet" seçilirken öğretmene küçük not (isteğe bağlı)
create or replace function public.d_karar_ver(p_key text, p_tip text, p_secim text, p_not text default '', p_kucuk text default null)
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
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi and isleniyor is null;
  insert into public.d_karar(key,tip,secim,notu,kim,kucuk_sorun) values (p_key,p_tip,p_secim,coalesce(p_not,''),auth.jwt()->>'email',
    case when p_secim='REDDET' and v_tur='c' then nullif(trim(coalesce(p_kucuk,'')),'') end) returning id into v_id;
  perform public.d_olay_yaz('karar',p_key,'karar_ver',v_eski,jsonb_build_object('tip',p_tip,'secim',p_secim,'notu',p_not,'kucuk_sorun',p_kucuk));
  return v_id;
end $$;
drop function if exists public.d_karar_ver(text,text,text,text);

revoke all on function public.d_basvuru_karar(bigint,text,int,text) from public, anon;
revoke all on function public.d_basvuru_karar_geri_al(bigint) from public, anon;
revoke all on function public.d_karar_ver(text,text,text,text,text) from public, anon;
grant execute on function public.d_basvuru_karar(bigint,text,int,text) to authenticated;
grant execute on function public.d_basvuru_karar_geri_al(bigint) to authenticated;
grant execute on function public.d_karar_ver(text,text,text,text,text) to authenticated;
