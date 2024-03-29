DROP FUNCTION IF EXISTS layer_obs_regions(geometry, int);

CREATE OR REPLACE FUNCTION layer_obs_regions(bbox geometry, zoom_level int)
RETURNS TABLE(
  region_id int,
  geometry geometry,
  name text,
  overtaking_event_count int
) AS $$

    SELECT
      -- region.id as region_id,
      NULL::int as region_id,
      -- ST_SimplifyPreserveTopology(region.geometry, ZRes(zoom_level + 2)) as geometry,
      region.geometry as geometry,
      region.name as name,
      count(overtaking_event.id)::int as overtaking_event_count
    FROM region
      LEFT OUTER JOIN overtaking_event on ST_Within(overtaking_event.geometry, region.geometry)
    WHERE
      zoom_level >= 3 AND
      zoom_level <= 12 AND
      region.geometry && bbox
    GROUP BY region.id, region.name, region.geometry

$$ LANGUAGE SQL IMMUTABLE;
