CREATE OR REPLACE FUNCTION layer_obs_roads(bbox geometry, zoom_level int)
RETURNS TABLE(way_id bigint, geometry geometry, distance_overtaker_mean float, direction int) AS $$

    SELECT
      road.way_id::bigint as way_id,
      road.geometry as geometry,
      avg(distance_overtaker) as distance_overtaker_mean,
      r.dir as direction
    FROM road
    JOIN overtaking_event on road.way_id = overtaking_event.way_id
    JOIN (VALUES (1, TRUE), (-1, FALSE)) AS r(dir, rev) ON overtaking_event.direction_reversed = r.rev
    WHERE road.geometry && bbox
    GROUP BY road.way_id, road.geometry, direction;

$$ LANGUAGE SQL IMMUTABLE;
