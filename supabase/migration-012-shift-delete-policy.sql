-- Migration 012: allow deleting shifts
-- The Cashup page lets owners/managers remove a shift row. RLS had no
-- DELETE policy, so client deletes were denied. Allow any member of the
-- restaurant to delete a shift (consistent with the other tables).

create policy "shift delete"
  on public.shifts
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));
