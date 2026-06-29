-- ============================================================================
-- Atomic per-user monthly AI quota.
-- Fixes audit findings:
--   H5  AI rate limit fails open on DB error
--   H6  TOCTOU race between quota check and usage log insert
--
-- The function counts usage rows for the current calendar month for a given
-- user + request_type, and only inserts a new row if doing so would keep
-- the count <= p_max. The count + insert run inside the same statement
-- so concurrent callers cannot exceed the quota.
--
-- Returns true if the request is allowed (and a log row was inserted),
-- false if quota is exhausted (no log row written).
--
-- SECURITY INVOKER (default) - runs as the caller (the user JWT), so RLS
-- policies still apply and the function cannot be abused to read/write
-- another user's quota.
-- ============================================================================

create or replace function public.try_consume_ai_quota(
  p_request_type text,
  p_max          integer,
  p_item_name    text default null
)
returns boolean
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_inserted boolean;
begin
  if v_user is null then
    raise exception 'try_consume_ai_quota requires an authenticated user'
      using errcode = '28000';
  end if;

  with current_count as (
    select count(*)::int as c
    from public.ai_usage_log
    where user_id = v_user
      and request_type = p_request_type
      and created_at >= date_trunc('month', now())
  ),
  ins as (
    insert into public.ai_usage_log (user_id, request_type, item_name)
    select v_user, p_request_type, p_item_name
    from current_count
    where current_count.c < p_max
    returning 1
  )
  select exists(select 1 from ins) into v_inserted;

  return v_inserted;
end;
$$;

revoke all on function public.try_consume_ai_quota(text, integer, text) from public;
grant execute on function public.try_consume_ai_quota(text, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Helper view for the AI usage summary the UI shows in Settings.
-- ----------------------------------------------------------------------------
create or replace view public.ai_usage_current_month with (security_invoker = on) as
select
  user_id,
  request_type,
  count(*) as used_this_month,
  max(created_at) as last_request_at
from public.ai_usage_log
where created_at >= date_trunc('month', now())
group by user_id, request_type;

grant select on public.ai_usage_current_month to authenticated;
