-- WEDDING MANAGEMENT V8 NEW
-- Remove PUBLIC/anonymous EXECUTE on SECURITY DEFINER helpers that are
-- only called from authenticated/admin application flows.
-- Keep explicit authenticated EXECUTE grants for existing application flows.
-- Safe to re-run.

revoke execute on function public.create_contract_from_confirmed_quote() from public;
revoke execute on function public.create_contract_from_quote() from public;
revoke execute on function public.ensure_floral_project_for_wedding() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_couple_member(uuid) from public;
revoke execute on function public.save_floral_project_section(uuid,text,text,text,text,text) from public;

grant execute on function public.create_contract_from_confirmed_quote() to authenticated;
grant execute on function public.create_contract_from_quote() to authenticated;
grant execute on function public.ensure_floral_project_for_wedding() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.save_floral_project_section(uuid,text,text,text,text,text) to authenticated;
