
DROP POLICY "Anyone can view event images" ON storage.objects;

CREATE POLICY "Anyone can view event images by direct URL"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');
