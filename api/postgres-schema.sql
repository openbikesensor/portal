CREATE TYPE zone_type IF NOT EXISTS AS ENUM ('urban', 'rural');

CREATE TABLE road_annotations IF NOT EXISTS (
  way_id integer,
  reverse boolean,
  name text,
  zone zone_type,
  distance_overtaker_mean float,
  distance_overtaker_median float,
  distance_overtaker_minimum float,
  distance_overtaker_n integer,
  distance_overtaker_n_below_limit integer,
  distance_overtaker_n_above_limit integer,
  distance_overtaker_limit float,
  distance_overtaker_measurements integer ARRAY,
);
