-- DEVELOPMENT RESET ONLY: running this file deletes all existing application data.
DROP TABLE IF EXISTS itinerary_items;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  preference_category TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, preference_category),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE itineraries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE itinerary_items (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 31),
  time_slot TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  location_name TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  source_url TEXT,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE
);

CREATE INDEX idx_rate_limits_expiry ON rate_limits(expires_at);
CREATE INDEX idx_itineraries_session_created ON itineraries(session_id, created_at DESC);
CREATE INDEX idx_itinerary_items_itinerary_day ON itinerary_items(itinerary_id, day_number, time_slot);
