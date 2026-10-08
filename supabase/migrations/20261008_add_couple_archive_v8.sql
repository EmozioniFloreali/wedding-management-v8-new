-- WEDDING MANAGEMENT V8 NEW
-- Archive completed couples without deleting their history.

alter table public.couples
  add column if not exists archived_at timestamptz null;

create index if not exists couples_archived_at_idx
  on public.couples (archived_at);

create or replace function public.set_couple_archived(
  p_couple_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Accesso amministratore richiesto';
  end if;

  update public.couples
     set archived_at = case when p_archived then now() else null end,
         updated_at = now()
   where id = p_couple_id;

  return found;
end;
$function$;

revoke execute on function public.set_couple_archived(uuid,boolean) from public;
grant execute on function public.set_couple_archived(uuid,boolean) to authenticated;
