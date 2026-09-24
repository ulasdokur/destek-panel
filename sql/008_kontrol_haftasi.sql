-- Haftalık kontrol kararı yalnız o hafta kontrol örneğine seçilmiş kayda verilebilir.
create or replace function public.d_karar_ver(p_key text, p_tip text, p_secim text, p_not text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_durum text; v_tur text; v_hedef bigint; v_hafta text;
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
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi;  -- fikir değiştirme
  insert into public.d_karar(key,tip,secim,notu,kim) values (p_key,p_tip,p_secim,coalesce(p_not,''),auth.jwt()->>'email') returning id into v_id;
  return v_id;
end $$;
