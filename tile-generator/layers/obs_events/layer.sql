CREATE OR REPLACE FUNCTION layer_obs_events(bbox geometry, zoom_level int)
RETURNS TABLE(event_id bigint, geometry geometry, distance_overtaker float, distance_stationary float, direction int, course float, speed float, zone zone_type, way_id bigint) AS $$

    SELECT
      id::bigint as event_id,
      ST_Transform(overtaking_event.geometry, 3857) as geometry,
      distance_overtaker,
      distance_stationary,
      (case when direction_reversed then -1 else 1 end)::int as direction,
      course,
      speed,
      CASE WHEN road.zone IS NULL THEN 'urban' else road.zone END as zone,
      overtaking_event.way_id::bigint as way_id
    FROM overtaking_event
    FULL OUTER JOIN road ON (road.way_id = overtaking_event.way_id)
    WHERE ST_Transform(overtaking_event.geometry, 3857) && bbox;

$$ LANGUAGE SQL IMMUTABLE;
