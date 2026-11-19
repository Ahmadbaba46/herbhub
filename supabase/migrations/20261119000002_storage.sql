-- =============================================================================
-- HerbHub storage buckets
--
--   avatars  (public read)  avatars/<profile_id>/<file>
--   catalog  (public read)  catalog/<item_id>/<file>        remedy/service images
--   chat     (private)      chat/<conversation_id>/<file>    voice notes, images, files
--   proofs   (private)      proofs/<patient_id>/<file>       bank-transfer proof
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('catalog', 'catalog', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('chat',    'chat',    false, 26214400, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/webm','application/pdf']),
  ('proofs',  'proofs',  false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Is the signed-in user a participant of this conversation?
create function public.in_conversation(p_convo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_convo
      and (public.is_owner() or c.assignee_id = auth.uid() or c.patient_id = public.my_patient_id())
  );
$$;

-- ---- avatars: anyone signed in reads; a user writes into their own folder ----
create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- catalog: anyone signed in reads; only owner writes ----
create policy catalog_read on storage.objects for select to authenticated
  using (bucket_id = 'catalog');
create policy catalog_write on storage.objects for all to authenticated
  using (bucket_id = 'catalog' and public.is_owner())
  with check (bucket_id = 'catalog' and public.is_owner());

-- ---- chat: participants of the conversation named in the path ----
create policy chat_read on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.in_conversation(((storage.foldername(name))[1])::uuid));
create policy chat_write on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.in_conversation(((storage.foldername(name))[1])::uuid));

-- ---- proofs: owner, or the patient whose folder it is ----
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (public.is_owner() or (storage.foldername(name))[1] = public.my_patient_id()::text));
create policy proofs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (public.is_owner() or (storage.foldername(name))[1] = public.my_patient_id()::text));
