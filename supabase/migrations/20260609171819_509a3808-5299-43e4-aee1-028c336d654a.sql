
-- Lock down SECURITY DEFINER helper functions: only RLS and triggers should call them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_class(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- touch_updated_at: fix search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Storage policies for banners + posts buckets
-- Path convention: {user_id}/filename.ext
CREATE POLICY "banners read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banners');
CREATE POLICY "banners write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "banners delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "posts read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'posts');
CREATE POLICY "posts write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "posts delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
