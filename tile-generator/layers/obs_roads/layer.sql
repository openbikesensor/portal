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
      e.distance_overtaker_mean,
      e.distance_overtaker_min,
      e.distance_overtaker_max,
      e.distance_overtaker_median,
      e.distance_overtaker_array,
      e.distance_overtaker_count,
      -- Since this is just one field we can subquery directly inline
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
      -- Generate the "offset" column to be 0 for undirectional roads
      case when road.directionality = 0 then r.dir else 0 end as offset_direction
    FROM road

    -- This JOIN duplicates directional roads with r.reversed set to TRUE and
    -- FALSE, but keeps undirectional roads single.
    LEFT JOIN (VALUES (-1, TRUE), (1, FALSE), (0, FALSE)) AS r(dir, rev) ON (abs(r.dir) != road.directionality)

    -- instead of a subquery, we join in a table that gives us overtaking
    -- statistics by way_id, filtered by user_id and time
    LEFT JOIN (
        SELECT
          overtaking_event.way_id as way_id,
          overtaking_event.direction_reversed as direction_reversed,
          avg(overtaking_event.distance_overtaker) as distance_overtaker_mean,
          min(overtaking_event.distance_overtaker) as distance_overtaker_min,
          max(overtaking_event.distance_overtaker) as distance_overtaker_max,
          -- complicated way of saying "median" :)
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overtaking_event.distance_overtaker) as distance_overtaker_median,
          -- get all single values as well
          array_agg(overtaking_event.distance_overtaker) as distance_overtaker_array,
          count(overtaking_event.id)::int as distance_overtaker_count
        FROM overtaking_event
        JOIN track ON track.id = overtaking_event.track_id
        WHERE (user_id is NULL or track.author_id = user_id)
          AND overtaking_event.time BETWEEN COALESCE(min_time, '1900-01-01'::timestamp) AND COALESCE(max_time, '2100-01-01'::timestamp)
        GROUP BY overtaking_event.way_id, overtaking_event.direction_reversed
    ) e on (e.way_id = road.way_id and (road.directionality != 0 or e.direction_reversed = r.rev))

    WHERE road.geometry && bbox
      AND zoom_level >= 10
    GROUP BY
      road.name,
      road.way_id,
      road.geometry,
      road.directionality,
      road.zone,
      r.dir,
      r.rev,
      e.way_id,
      e.direction_reversed,
      e.distance_overtaker_mean,
      e.distance_overtaker_min,
      e.distance_overtaker_max,
      e.distance_overtaker_median,
      e.distance_overtaker_array,
      e.distance_overtaker_count
    ;

$$ LANGUAGE SQL IMMUTABLE;
