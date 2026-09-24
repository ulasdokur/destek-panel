-- Kaydedilen kararı geri alma (30 sn'lik "Geri al" düğmesi) + admin panel profil bağlantıları için seo adları
alter table public.d_sikayet add column if not exists ogretmen_seo text, add column if not exists ogrenci_seo text;

create or replace function public.d_karar_geri_al(p_key text, p_tip text)
returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  delete from public.d_karar where key=p_key and tip=p_tip and not uygulandi and kim=auth.jwt()->>'email';
  get diagnostics n = row_count;
  if n=0 then raise exception 'geri_alinamaz'; end if;   -- işlenmiş ya da başkasının kararı
  return n;
end $$;

create or replace function public.d_basvuru_kontrol_geri_al(p_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.d_yetkili_mi() then raise exception 'yetkisiz'; end if;
  update public.d_basvuru set kontrol_secim=null, kontrol_not=null, kontrol_kim=null, kontrol_zamani=null
   where id=p_id and kontrol_kim=auth.jwt()->>'email';
  if not found then raise exception 'geri_alinamaz'; end if;
end $$;

revoke all on function public.d_karar_geri_al(text,text) from public, anon;
revoke all on function public.d_basvuru_kontrol_geri_al(bigint) from public, anon;
grant execute on function public.d_karar_geri_al(text,text) to authenticated;
grant execute on function public.d_basvuru_kontrol_geri_al(bigint) to authenticated;
