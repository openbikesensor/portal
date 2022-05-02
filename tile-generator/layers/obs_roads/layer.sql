DROP FUNCTION IF EXISTS layer_obs_roads(geometry, int);
DROP FUNCTION IF EXISTS layer_obs_roads(geometry, int, integer, timestamp, timestamp);

CREATE OR REPLACE FUNCTION layer_obs_roads(bbox geometry, zoom_level int, user_id integer, min_time timestamp, max_time timestamp)
RETURNS TABLE(
  way_id bigint,
  geometry geometry,
  distance_overtaker_mean float,
  distance_overtaker_min float,
  distance_overtaker_max float,
  distance_overtaker_median float,
  distance_overtaker_array float[],
  overtaking_event_count int,
  usage_count bigint,
  direction int,
  zone zone_type,
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
      (
        SELECT count(road_usage.id) from road_usage
        JOIN track ON track.id = road_usage.track_id
        WHERE road_usage.way_id = road.way_id
          AND (road.directionality != 0 or road_usage.direction_reversed = r.rev)
          AND (user_id is NULL or user_id = track.author_id)
          AND road_usage.time BETWEEN COALESCE(min_time, '1900-01-01'::timestamp) AND COALESCE(max_time, '2100-01-01'::timestamp)
      ) as usage_count,
      r.dir as direction,
      road.zone::zone_type as zone,
      case when road.directionality = 0 then r.dir else 0 end as offset_direction
    FROM road
    LEFT JOIN (VALUES (-1, TRUE), (1, FALSE), (0, FALSE)) AS r(dir, rev) ON (abs(r.dir) != road.directionality)
    FULL OUTER JOIN overtaking_event ON (road.way_id = overtaking_event.way_id and (road.directionality != 0 or overtaking_event.direction_reversed = r.rev))
      JOIN track ON overtaking_event.track_id = track.id
    WHERE road.geometry && bbox
      AND (user_id is NULL or user_id = track.author_id)
      AND overtaking_event.time BETWEEN COALESCE(min_time, '1900-01-01'::timestamp) AND COALESCE(max_time, '2100-01-01'::timestamp)
    GROUP BY road.name, road.way_id, road.geometry, road.directionality, road.zone, r.dir, r.rev;

$$ LANGUAGE SQL IMMUTABLE;
