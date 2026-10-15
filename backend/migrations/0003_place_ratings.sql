-- Migration 0003: Add Google Maps rating, user_ratings_total, and source_name to itinerary_items
ALTER TABLE itinerary_items ADD COLUMN rating REAL;
ALTER TABLE itinerary_items ADD COLUMN user_ratings_total INTEGER;
ALTER TABLE itinerary_items ADD COLUMN source_name TEXT DEFAULT 'Google Maps';
