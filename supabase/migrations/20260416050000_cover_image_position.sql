-- Add cover_image_position to events so hosts can adjust the focal point
-- Format: "X% Y%" (CSS object-position value), default is center "50% 50%"
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cover_image_position TEXT DEFAULT '50% 50%';
