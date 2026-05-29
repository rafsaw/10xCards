-- S-02: atomic finalize of a draft batch.
-- See context/changes/atomic-save-to-deck/plan.md for the full contract.
--
-- public.finalize_drafts promotes accepted drafts to status='saved' (with a
-- concrete next_due_at so they enter the S-04 review query) and hard-deletes
-- rejected drafts, in a single transaction (the function call is the boundary;
-- any raised exception rolls back both statements). It is SECURITY INVOKER so
-- the existing cards_update_own / cards_delete_own RLS policies evaluate
-- auth.uid() as the caller — passing another user's id is a silent no-op, not a
-- leak. Both statements guard on status='draft', making double-submits and
-- stale tabs idempotent. Affected counts come from GET DIAGNOSTICS, not the
-- input array lengths.

create function public.finalize_drafts(p_accept_ids uuid[], p_reject_ids uuid[])
returns table (saved_count integer, discarded_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cards
    set status = 'saved', next_due_at = now()
    where id = any(p_accept_ids) and status = 'draft';
  get diagnostics saved_count = row_count;

  delete from public.cards
    where id = any(p_reject_ids) and status = 'draft';
  get diagnostics discarded_count = row_count;

  return query select saved_count, discarded_count;
end;
$$;

grant execute on function public.finalize_drafts(uuid[], uuid[]) to authenticated;
