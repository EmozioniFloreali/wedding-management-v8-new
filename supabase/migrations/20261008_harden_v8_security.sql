-- WEDDING MANAGEMENT V8 NEW
-- Security hardening applied to the production Supabase project.
-- Safe to re-run: all statements are idempotent.

create or replace function public.touch_floral_project_sections_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke execute on function public.create_contract_from_confirmed_quote() from anon;
revoke execute on function public.create_contract_from_quote() from anon;
revoke execute on function public.ensure_floral_project_for_wedding() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_couple_member(uuid) from anon;
revoke execute on function public.save_floral_project_section(uuid,text,text,text,text,text) from anon;
