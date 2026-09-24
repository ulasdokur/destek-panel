-- Uyarı onayını / "gönderme" kararını geri al: kayıt yeniden taslak olur. Gönderim başladıysa (gonderim dolu) geri alınamaz.
create or replace function public.d_uyari_geri_al(p_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_uyari set durum='taslak', karar_veren=null, karar_zamani=null
   where id=p_id and durum in ('onaylandi','iptal') and gonderim is null;
  if not found then raise exception 'degistirilemez'; end if;
end $$;
revoke all on function public.d_uyari_geri_al(bigint) from public, anon;
grant execute on function public.d_uyari_geri_al(bigint) to authenticated;
