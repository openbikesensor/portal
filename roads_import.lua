--
-- To use this file, see
-- https://mygisnotes.wordpress.com/2015/10/09/openstreepmap-import-data-into-a-postgis-database-and-incrementally-update-it/
-- for general instructions:
-- 1. Download PBF
-- 2. Convert and filter to your needs
-- 3. Run the import like this:
--
--    osm2pgsql --create --hstore --style roads_import.lua -O flex \
--      --proj 32629 -H localhost -d obs -U obs -W \
--      YOUR_FILE.o5m

local function contains(table, val)
  for i=1,#table do
    if table[i] == val then
      return true
    end
  end
  return false
end

local HIGHWAY_TYPES = {
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  -- "trunk_link",
  -- "primary_link",
  -- "secondary_link",
  -- "tertiary_link",
  "living_street",
  "service",
  "track",
  "road",
}
local ZONE_TYPES = {
  "urban",
  "rural",
  "motorway",
}
local URBAN_TYPES = {
  "residential",
  "living_street",
  "road",
}
local MOTORWAY_TYPES = {
  "motorway",
  -- "motorway_link",
}

local ADMIN_LEVEL_MIN = 2
local ADMIN_LEVEL_MAX = 8

local ONEWAY_YES = {"yes", "true", "1"}
local ONEWAY_REVERSE = {"reverse", "-1"}

-- https://wiki.openstreetmap.org/wiki/Tag:highway=service
local IGNORED_SERVICE_TYPES = {"parking_aisle", "driveway", "emergency_access", "drive-through"}

-- https://taginfo.openstreetmap.org/keys/access#values
local IGNORED_ACCESS_TYPES = {"no", "private", "permit", "official", "service", "emergency"}

local roads = osm2pgsql.define_way_table('road', {
  { column = 'zone', type = 'text', sql_type="zone_type" },
  { column = 'directionality', type = 'int' },
  { column = 'name', type = 'text' },
  { column = 'geometry', type = 'linestring' },
  { column = 'oneway', type = 'bool' },
})

local regions = osm2pgsql.define_relation_table('region', {
  { column = 'name', type = 'text' },
  { column = 'geometry', type = 'geometry' },
  { column = 'admin_level', type = 'int' },
  { column = 'tags', type = 'hstore' },
})


function osm2pgsql.process_way(object)
  local tags = object.tags

  -- only import certain highway ways, i.e. roads and pathways
  if not tags.highway then return end
  if not contains(HIGHWAY_TYPES, tags.highway) then return end

  -- do not import areas (plazas etc.)
  if tags.area == "yes" then return end

  -- ignore certain service roads
  if contains(IGNORED_SERVICE_TYPES, tags.service) then return end

  -- ignore disallowed roads (often tram tracks and similar)
  if contains(IGNORED_ACCESS_TYPES, tags.access) then return end

  local zone = nil

  if tags["zone:traffic"] then
    zone = tags["zone:traffic"]

    if zone == "DE:urban" then
      zone = "urban"
    elseif zone == "DE:rural" then
      zone = "rural"
    elseif zone == "DE:motorway" then
      zone = "motorway"
    elseif string.match(zone, "rural") then
      zone = "rural"
    elseif string.match(zone, "urban") then
      zone = "urban"
    elseif string.match(zone, "motorway") then
      zone = "motorway"
    elseif contains(URBAN_TYPES, tags.highway) then
      zone = "urban"
    elseif contains(MOTORWAY_TYPES, tags.highway) then
      zone = "motorway"
    else
      -- we can't figure it out
      zone = nil
    end
  end

  local directionality = 0
  local oneway = tags.oneway

  -- See https://wiki.openstreetmap.org/wiki/Key:oneway section "Implied oneway restriction"
  if contains(ONEWAY_YES, tags.oneway) or tags.junction == "roundabout" or zone == "motorway" then
    directionality = 1
    oneway = true
  elseif contains(ONEWAY_REVERSE, tags.oneway) then
    directionality = -1
    oneway = true
  end

  roads:add_row({
    geom = { create = 'linear' },
    name = tags.name,
    zone = zone,
    directionality = directionality,
    oneway = oneway,
  })
end

function osm2pgsql.process_relation(object)
  local admin_level = tonumber(object.tags.admin_level)
  if object.tags.boundary == "administrative" and admin_level and admin_level >= ADMIN_LEVEL_MIN and admin_level <= ADMIN_LEVEL_MAX then
    regions:add_row({
      geometry = { create = 'area' },
      name = object.tags.name,
      admin_level = admin_level,
      tags = object.tags,
    })
  end
end

function osm2pgsql.select_relation_members(relation)
    if relation.tags.type == 'route' then
        return { ways = osm2pgsql.way_member_ids(relation) }
    end
end
