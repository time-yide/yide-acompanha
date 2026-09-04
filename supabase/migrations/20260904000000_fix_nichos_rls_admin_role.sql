-- Fix: role = 'admin' não existe no sistema, o correto é 'adm'/'socio'.
-- Recria as policies de insert/update/delete com os roles certos.

drop policy if exists "nichos_insert" on nichos;
drop policy if exists "nichos_update" on nichos;
drop policy if exists "nichos_delete" on nichos;

create policy "nichos_insert" on nichos
  for insert to authenticated
  with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('adm', 'socio')
    )
  );

create policy "nichos_update" on nichos
  for update to authenticated
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('adm', 'socio')
    )
  );

create policy "nichos_delete" on nichos
  for delete to authenticated
  using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('adm', 'socio')
    )
  );
