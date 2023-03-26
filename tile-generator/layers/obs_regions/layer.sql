DROP FUNCTION IF EXISTS layer_obs_regions(geometry, int);

CREATE OR REPLACE FUNCTION layer_obs_regions(bbox geometry, zoom_level int)
RETURNS TABLE(
  region_id bigint,
  geometry geometry,
  name text,
  admin_level int,
  overtaking_event_count int
) AS $$

    SELECT
      region.relation_id::bigint as region_id,
      ST_SimplifyPreserveTopology(region.geometry, ZRes(zoom_level + 2)) as geometry,
      region.name as name,
      region.admin_level as admin_level,
      count(overtaking_event.id)::int as overtaking_event_count
    FROM region
      LEFT JOIN overtaking_event on ST_Within(ST_Transform(overtaking_event.geometry, 3857), region.geometry)
    WHERE
      zoom_level >= 4 AND
      zoom_level <= 12 AND
      region.admin_level = 6 AND
      region.geometry && bbox
    GROUP BY region.relation_id, region.name, region.geometry, region.admin_level

$$ LANGUAGE SQL IMMUTABLE;
