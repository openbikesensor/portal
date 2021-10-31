--
-- To use this file, see
-- https://mygisnotes.wordpress.com/2015/10/09/openstreepmap-import-data-into-a-postgis-database-and-incrementally-update-it/
-- for general instructions:
-- 1. Download PBF
-- 2. Convert and filter to your needs
-- 3. Run the import like this:
--
--    osm2pgsql --create --hstore --style api/roads_import.lua -O flex \
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
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
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
  "motorway_link",
}

local ONEWAY_YES = {"yes", "true", "1"}
local ONEWAY_REVERSE = {"reverse", "-1"}

local roads = osm2pgsql.define_way_table('road', {
  { column = 'zone', type = 'text', sql_type="zone_type" },
  { column = 'directionality', type = 'int' },
  { column = 'name', type = 'text' },
  { column = 'geometry', type = 'linestring' },
  { column = 'tags', type = 'hstore' },
})

function osm2pgsql.process_way(object)
  if object.tags.highway and contains(HIGHWAY_TYPES, object.tags.highway) then
    local tags = object.tags
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
    if contains(ONEWAY_YES, tags["oneway"]) then
      directionality = 1
    elseif contains(ONEWAY_REVERSE, tags["oneway"]) then
      directionality = -1
    end

    roads:add_row({
      geom = { create = 'linear' },
      name = tags.name,
      zone = zone,
      directionality = directionality,
      tags = tags,
    })
  end
end
