-- Backfill: favorite status belongs to the meal (recipe, or free-text name),
-- not the calendar slot. Historical data has cases where the same meal was
-- favorited on one day but not on others it was also planned for, which
-- showed up as duplicate entries in the Favorites list. This makes every
-- sibling row consistent, matching the propagation logic now enforced by the
-- API (see api/_routes/meal-plans/index.ts and [id].ts).
--
-- Idempotent - safe to re-run. Uses the same identity rules as the app:
-- match by recipe_id when set, otherwise by case-insensitive meal_name.

-- 1) Recipe-linked meals: propagate favorite status across all plan rows
--    sharing the same user_id + recipe_id.
update public.meal_plans mp
set is_favorite = true
where mp.recipe_id is not null
  and mp.is_favorite = false
  and exists (
    select 1
    from public.meal_plans fav
    where fav.user_id = mp.user_id
      and fav.recipe_id = mp.recipe_id
      and fav.is_favorite = true
  );

-- 2) Free-text meals (no recipe_id): propagate by case-insensitive name match.
update public.meal_plans mp
set is_favorite = true
where mp.recipe_id is null
  and mp.is_favorite = false
  and exists (
    select 1
    from public.meal_plans fav
    where fav.user_id = mp.user_id
      and fav.recipe_id is null
      and lower(fav.meal_name) = lower(mp.meal_name)
      and fav.is_favorite = true
  );
