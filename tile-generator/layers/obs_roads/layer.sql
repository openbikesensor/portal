CREATE OR REPLACE FUNCTION layer_obs_roads(bbox geometry, zoom_level int)
RETURNS TABLE(
  way_id bigint,
  geometry geometry,
  distance_overtaker_mean float,
  distance_overtaker_min float,
  distance_overtaker_max float,
  distance_overtaker_median float,
  distance_overtaker_array float[],
  overtaking_event_count int,
  direction int,
  offset_direction int
) AS $$

    SELECT
      road.way_id::bigint as way_id,
      road.geometry as geometry,
      avg(distance_overtaker) as distance_overtaker_mean,
      min(distance_overtaker) as distance_overtaker_min,
      max(distance_overtaker) as distance_overtaker_max,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY distance_overtaker) as distance_overtaker_median,
      array_agg(distance_overtaker) as distance_overtaker_array,
      count(overtaking_event.id)::int as distance_overtaker_count,
      r.dir as direction,
      case when road.directionality = 0 then r.dir else 0 end as offset_direction
    FROM road
    FULL OUTER JOIN (VALUES (1, TRUE), (-1, FALSE)) AS r(dir, rev) ON (road.directionality = 0 or road.directionality = r.dir)
    FULL OUTER JOIN overtaking_event ON (road.way_id = overtaking_event.way_id and overtaking_event.direction_reversed = r.rev)
    -- WHERE road.name = 'Schlierbergstraße'
    WHERE road.geometry && bbox
    GROUP BY road.way_id, road.geometry, road.directionality, direction;

$$ LANGUAGE SQL IMMUTABLE;
