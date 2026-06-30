-- Make ALL categories editable/deletable by this user.
-- Converts the shared read-only "system" categories into personal categories
-- owned by the user, so the app shows edit/delete on every category and the
-- RLS update/delete policies (which require user_id = auth.uid() and
-- is_system = false) allow it.
--
-- NOTE: this is intended for a single-user deployment. It reassigns the shared
-- default categories to one user; other users would no longer see them.
do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users
  where lower(email) = lower('lehoangnhatduy2000@gmail.com');
  if v_user is null then
    raise exception 'No auth user for that email - sign up / log in first';
  end if;

  update public.categories
    set is_system = false,
        user_id   = v_user
  where is_system = true;
end $$;
