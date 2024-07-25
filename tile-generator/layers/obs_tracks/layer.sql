DROP FUNCTION IF EXISTS layer_obs_tracks(geometry, int, integer, timestamp, timestamp);

CREATE OR REPLACE FUNCTION layer_obs_tracks(bbox geometry, zoom_level int, user_id integer, min_time timestamp, max_time timestamp)
RETURNS TABLE(
  track_id bigint,
  geometry geometry
) AS $$

    SELECT
      track.id::bigint as track_id,
      track.geometry as geometry
    FROM track
    WHERE track.author_id = user_id
      AND track.geometry && bbox
      AND zoom_level >= 10
      AND track.recorded_at BETWEEN COALESCE(min_time, '1900-01-01'::timestamp) AND COALESCE(max_time, '2100-01-01'::timestamp);

$$ LANGUAGE SQL IMMUTABLE;
