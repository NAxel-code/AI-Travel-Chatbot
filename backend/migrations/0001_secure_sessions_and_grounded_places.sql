-- Apply this only to an existing database created with the original schema.
-- New databases should use schema.sql instead.
ALTER TABLE sessions ADD COLUMN access_token_hash TEXT;

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  preference_category TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, preference_category),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

ALTER TABLE itineraries ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE itinerary_items ADD COLUMN location_name TEXT;
ALTER TABLE itinerary_items ADD COLUMN address TEXT;
ALTER TABLE itinerary_items ADD COLUMN latitude REAL;
ALTER TABLE itinerary_items ADD COLUMN longitude REAL;
ALTER TABLE itinerary_items ADD COLUMN source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_itineraries_session_created ON itineraries(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_itinerary_day ON itinerary_items(itinerary_id, day_number, time_slot);
