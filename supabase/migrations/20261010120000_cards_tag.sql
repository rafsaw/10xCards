alter table public.cards
  add column tag text
    check (tag is null or (tag = btrim(tag) and char_length(tag) between 1 and 40));

create index cards_user_id_tag_idx on public.cards (user_id, tag) where tag is not null;

-- distinct tags of the caller, oldest-first-used first; RLS scopes to the owner
create function public.card_tags()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select tag from public.cards where tag is not null group by tag order by min(created_at), tag;
$$;

grant execute on function public.card_tags() to authenticated;
