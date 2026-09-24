-- Roller: yonetici (Ulaş, Beyaz) her şey; destek (CS) pasife alma onayı veremez.
create or replace function public.d_yonetici_mi() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.d_yetkili where email = lower(coalesce(auth.jwt()->>'email','')) and rol='yonetici')
$$;
create or replace function public.d_uyari_karar(p_id bigint, p_onay boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_kademe text;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  select kademe into v_kademe from public.d_uyari where id=p_id;
  if v_kademe='PASIF' and p_onay and not public.d_yonetici_mi() then raise exception 'sadece_yonetici'; end if;
  update public.d_uyari set durum = case when p_onay then 'onaylandi' else 'iptal' end,
         karar_veren = auth.jwt()->>'email', karar_zamani = now()
   where id=p_id and durum in ('taslak','onaylandi','iptal') and gonderim is null;
  if not found then raise exception 'degistirilemez'; end if;
end $$;
revoke all on function public.d_yonetici_mi() from public, anon;
grant execute on function public.d_yonetici_mi() to authenticated;
