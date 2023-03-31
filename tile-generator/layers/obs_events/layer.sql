CREATE OR REPLACE FUNCTION layer_obs_events(bbox geometry, zoom_level int, user_id integer, min_time timestamp, max_time timestamp)
RETURNS TABLE(event_id bigint, geometry geometry, distance_overtaker float, distance_stationary float, direction int, course float, speed float, zone zone_type, way_id bigint) AS $$

    SELECT
      overtaking_event.id::bigint as event_id,
      ST_Transform(overtaking_event.geometry, 3857) as geometry,
      distance_overtaker,
      distance_stationary,
      (case when direction_reversed then -1 else 1 end)::int as direction,
      course,
      speed,
      CASE WHEN road.zone IS NULL THEN 'urban' else road.zone END as zone,
      overtaking_event.way_id::bigint as way_id
    FROM overtaking_event
    FULL OUTER JOIN road ON road.way_id = overtaking_event.way_id
    JOIN track on track.id = overtaking_event.track_id
    WHERE ST_Transform(overtaking_event.geometry, 3857) && bbox
      AND zoom_level >= 8
      AND (user_id is NULL OR user_id = track.author_id)
      AND time BETWEEN COALESCE(min_time, '1900-01-01'::timestamp) AND COALESCE(max_time, '2100-01-01'::timestamp);

$$ LANGUAGE SQL IMMUTABLE;
