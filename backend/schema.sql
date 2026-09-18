DROP TABLE IF EXISTS itinerary_items;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE itineraries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE itinerary_items (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  time_slot TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id)
);
