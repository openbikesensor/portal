const roadColor = '#DDD'
const woodColor = 'hsl(110, 30%, 94%)'
const waterColor = 'hsl(180, 30%, 80%)'
const builtupColor = 'hsl(30, 10%, 92%)'

function withZoom(baseSize: number) {
  return [
    'interpolate',
    ['exponential', 2],
    ['zoom'],
    10,
    ['*', baseSize, ['^', 2, -6]],
    24,
    ['*', baseSize, ['^', 2, 8]],
  ]
}

const obsLight = {
  version: 8,
  name: 'OpenBikeSensor Light',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openbikesensor.org/data/basemap.json',
    },
  },
  sprite: 'https://openmaptiles.github.io/osm-bright-gl-style/sprite',
  glyphs: 'https://tiles.openbikesensor.org/fonts/{fontstack}/{range}.pbf?key={key}',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {'background-color': 'hsl(0, 0, 98%)'},
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'brunnel', 'tunnel']],
      layout: {visibility: 'visible'},
      paint: {'fill-antialias': true, 'fill-color': waterColor},
    },
    {
      id: 'nogo',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['all', ['==', '$type', 'Polygon'], ['in', 'class', 'railway', 'military']],
      paint: {
        'fill-color': 'hsl(30, 10%, 90%)',
      },
    },
    {
      id: 'builtup',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: [
        'all',
        ['==', '$type', 'Polygon'],
        [
          'in',
          'class',
          'residential',
          'commercial',
          'industrial',
          'retail',
          'school',
          'university',
          'kindergarten',
          'college',
          'library',
          'hospital',
        ],
      ],
      paint: {
        'fill-color': builtupColor,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 1, 15, 0],
      },
    },

    {
      id: 'parks',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      maxzoom: 17,
      filter: [
        'all',
        ['==', '$type', 'Polygon'],
        ['in', 'class', 'cemetery', 'stadium', 'pitch', 'playground', 'track', 'theme_park', 'zoo'],
      ],
      paint: {'fill-color': woodColor},
    },
    {
      id: 'landcover_wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      minzoom: 10,
      filter: ['all', ['==', '$type', 'Polygon'], ['in', 'class', 'wood', 'grass', 'farmland']],
      layout: {visibility: 'visible'},
      paint: {
        'fill-color': woodColor,
        'fill-opacity': {
          base: 1,
          stops: [
            [8, 0],
            [12, 1],
          ],
        },
      },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-antialias': true,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 1],
        'fill-color': 'hsl(200, 5%, 95%)',
      },
    },
    {
      id: 'tunnel_motorway_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'brunnel', 'tunnel'], ['==', 'class', 'motorway']]],
      layout: {
        'line-cap': 'butt',
        'line-join': 'miter',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'rgb(213, 213, 213)',
        'line-opacity': 1,
        'line-width': {
          base: 1.4,
          stops: [
            [5.8, 0],
            [6, 3],
            [20, 40],
          ],
        },
      },
    },
    {
      id: 'tunnel_motorway_inner',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'brunnel', 'tunnel'], ['==', 'class', 'motorway']]],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'rgb(234,234,234)',
        'line-width': {
          base: 1.4,
          stops: [
            [4, 2],
            [6, 1.3],
            [20, 30],
          ],
        },
      },
    },
    {
      id: 'aeroway-taxiway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      minzoom: 12,
      filter: ['all', ['in', 'class', 'taxiway']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'hsl(0, 0%, 88%)',
        'line-opacity': 1,
        'line-width': {
          base: 1.55,
          stops: [
            [13, 1.8],
            [20, 20],
          ],
        },
      },
    },
    {
      id: 'aeroway-runway-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: ['all', ['in', 'class', 'runway']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'hsl(0, 0%, 88%)',
        'line-opacity': 1,
        'line-width': {
          base: 1.5,
          stops: [
            [11, 6],
            [17, 55],
          ],
        },
      },
    },
    {
      id: 'aeroway-area',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      minzoom: 4,
      filter: ['all', ['==', '$type', 'Polygon'], ['in', 'class', 'runway', 'taxiway']],
      layout: {visibility: 'visible'},
      paint: {
        'fill-color': 'rgba(255, 255, 255, 1)',
        'fill-opacity': {
          base: 1,
          stops: [
            [13, 0],
            [14, 1],
          ],
        },
      },
    },
    {
      id: 'aeroway-runway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: ['all', ['in', 'class', 'runway'], ['==', '$type', 'LineString']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'rgba(255, 255, 255, 1)',
        'line-opacity': 1,
        'line-width': {
          base: 1.5,
          stops: [
            [11, 4],
            [17, 50],
          ],
        },
      },
    },
    {
      id: 'road_area_pier',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'Polygon'], ['==', 'class', 'pier']],
      layout: {visibility: 'visible'},
      paint: {'fill-antialias': true, 'fill-color': 'rgb(242,243,240)'},
    },
    {
      id: 'road_pier',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'pier']],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {
        'line-color': 'rgb(242,243,240)',
        'line-width': {
          base: 1.2,
          stops: [
            [15, 1],
            [17, 4],
          ],
        },
      },
    },
    {
      id: 'paths',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'path']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      minzoom: 15,
      paint: {
        'line-color': '#BBB',
        'line-opacity': 0.3,
        'line-width': withZoom(0.5),
        'line-dasharray': [4, 4],
      },
    },

    {
      id: 'highway-minor-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'minor', 'track']],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {
        'line-color': roadColor,
        'line-width': withZoom(8),
      },
    },

    {
      id: 'big_roads_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': roadColor,
        'line-width': withZoom(12),
      },
    },
    {
      id: 'small_roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 8,
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'minor', 'track']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'white',
        'line-width': withZoom(6),
      },
    },

    {
      id: 'big_roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'white',
        'line-width': withZoom(10),
      },
    },

    {
      id: 'big_roads_when_zoomed_out',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      maxzoom: 11,
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {'line-color': 'hsla(0, 0%, 85%, 0.69)', 'line-width': 2},
    },
    {
      id: 'highway_motorway_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'all',
        ['==', '$type', 'LineString'],
        ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'motorway']],
      ],
      layout: {
        'line-cap': 'butt',
        'line-join': 'miter',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'rgb(213, 213, 213)',
        'line-dasharray': [2, 0],
        'line-opacity': 1,
        'line-width': {
          base: 1.4,
          stops: [
            [5.8, 0],
            [6, 3],
            [20, 40],
          ],
        },
      },
    },
    {
      id: 'highway_motorway_inner',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: [
        'all',
        ['==', '$type', 'LineString'],
        ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'motorway']],
      ],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': {
          base: 1,
          stops: [
            [5.8, 'hsla(0, 0%, 85%, 0.53)'],
            [6, '#fff'],
          ],
        },
        'line-width': {
          base: 1.4,
          stops: [
            [4, 2],
            [6, 1.3],
            [20, 30],
          ],
        },
      },
    },
    {
      id: 'highway_motorway_subtle',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      maxzoom: 6,
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'motorway']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'hsla(0, 0%, 85%, 0.53)',
        'line-width': {
          base: 1.4,
          stops: [
            [4, 2],
            [6, 1.3],
          ],
        },
      },
    },
    {
      id: 'railway_transit',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'class', 'transit'], ['!in', 'brunnel', 'tunnel']]],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {'line-color': '#dddddd', 'line-width': 3},
    },
    {
      id: 'railway_transit_dashline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'class', 'transit'], ['!in', 'brunnel', 'tunnel']]],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {
        'line-color': '#fafafa',
        'line-dasharray': [3, 3],
        'line-width': 2,
      },
    },
    {
      id: 'railway_service',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'class', 'rail'], ['has', 'service']]],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {'line-color': '#dddddd', 'line-width': 3},
    },
    {
      id: 'railway_service_dashline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'rail'], ['has', 'service']],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {
        'line-color': '#fafafa',
        'line-dasharray': [3, 3],
        'line-width': 2,
      },
    },
    {
      id: 'railway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['!has', 'service'], ['==', 'class', 'rail']]],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {
        'line-color': '#dddddd',
        'line-width': {
          base: 1.3,
          stops: [
            [16, 3],
            [20, 7],
          ],
        },
      },
    },
    {
      id: 'railway_dashline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['!has', 'service'], ['==', 'class', 'rail']]],
      layout: {'line-join': 'round', visibility: 'visible'},
      paint: {
        'line-color': '#fafafa',
        'line-dasharray': [3, 3],
        'line-width': {
          base: 1.3,
          stops: [
            [16, 2],
            [20, 6],
          ],
        },
      },
    },
    {
      id: 'highway_motorway_bridge_casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'brunnel', 'bridge'], ['==', 'class', 'motorway']]],
      layout: {
        'line-cap': 'butt',
        'line-join': 'miter',
        visibility: 'visible',
      },
      paint: {
        'line-color': 'rgb(213, 213, 213)',
        'line-dasharray': [2, 0],
        'line-opacity': 1,
        'line-width': {
          base: 1.4,
          stops: [
            [5.8, 0],
            [6, 5],
            [20, 45],
          ],
        },
      },
    },
    {
      id: 'highway_motorway_bridge_inner',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', ['==', '$type', 'LineString'], ['all', ['==', 'brunnel', 'bridge'], ['==', 'class', 'motorway']]],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-color': {
          base: 1,
          stops: [
            [5.8, 'hsla(0, 0%, 85%, 0.53)'],
            [6, '#fff'],
          ],
        },
        'line-width': {
          base: 1.4,
          stops: [
            [4, 2],
            [6, 1.3],
            [20, 30],
          ],
        },
      },
    },

    {
      id: 'highway-name-path',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 15.5,
      filter: ['==', 'class', 'path'],
      layout: {
        'symbol-placement': 'line',
        'text-field': '{name:latin} {name:nonlatin}',
        'text-font': ['Open Sans Regular'],
        'text-rotation-alignment': 'map',
        'text-size': {
          base: 1,
          stops: [
            [13, 12],
            [14, 13],
          ],
        },
      },
      paint: {
        'text-color': 'hsl(30, 23%, 62%)',
        'text-halo-color': '#f8f4f0',
        'text-halo-width': 0.5,
      },
    },
    {
      id: 'highway-name-minor',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 15,
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'minor', 'track']],
      layout: {
        'symbol-placement': 'line',
        'text-field': '{name:latin} {name:nonlatin}',
        'text-font': ['Open Sans Regular'],
        'text-rotation-alignment': 'map',
        'text-size': 10,
        'text-allow-overlap': false,
        'symbol-spacing': 250,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#765',
        'text-halo-blur': 0.5,
        'text-halo-width': 1,
      },
    },
    {
      id: 'highway-name-major',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 12.2,
      filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk'],
      layout: {
        'symbol-placement': 'line',
        'text-field': '{name:latin} {name:nonlatin}',
        'text-font': ['Open Sans Regular'],
        'text-rotation-alignment': 'map',
        'text-size': {
          base: 1.3,
          stops: [
            [14, 9],
            [20, 24],
          ],
        },
      },
      paint: {
        'text-color': '#765',
        'text-halo-blur': 0.5,
        'text-halo-width': 1,
      },
    },

    {
      id: 'boundary_state',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 4],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      paint: {
        'line-blur': 0.4,
        'line-color': 'rgb(230, 204, 207)',
        'line-dasharray': [2, 2],
        'line-opacity': 1,
        'line-width': {
          base: 1.3,
          stops: [
            [3, 1],
            [22, 15],
          ],
        },
      },
    },
    {
      id: 'boundary_country_z0-4',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      maxzoom: 5,
      filter: ['all', ['==', 'admin_level', 2], ['!has', 'claimed_by']],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {
        'line-blur': {
          base: 1,
          stops: [
            [0, 0.4],
            [22, 4],
          ],
        },
        'line-color': 'rgb(230, 204, 207)',
        'line-opacity': 1,
        'line-width': {
          base: 1.1,
          stops: [
            [3, 1],
            [22, 20],
          ],
        },
      },
    },
    {
      id: 'boundary_country_z5-',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      minzoom: 5,
      filter: ['==', 'admin_level', 2],
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {
        'line-blur': {
          base: 1,
          stops: [
            [0, 0.4],
            [22, 4],
          ],
        },
        'line-color': 'rgb(230, 204, 207)',
        'line-opacity': 1,
        'line-width': {
          base: 1.1,
          stops: [
            [3, 1],
            [22, 20],
          ],
        },
      },
    },
    {
      id: 'place_other',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 14,
      filter: [
        'all',
        ['in', 'class', 'continent', 'hamlet', 'neighbourhood', 'isolated_dwelling'],
        ['==', '$type', 'Point'],
      ],
      layout: {
        'text-anchor': 'center',
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'center',
        'text-offset': [0.5, 0],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_suburb',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 15,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'suburb']],
      layout: {
        'text-anchor': 'center',
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'center',
        'text-offset': [0.5, 0],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_village',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 14,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'village']],
      layout: {
        'icon-size': 0.4,
        'text-anchor': 'left',
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'left',
        'text-offset': [0.5, 0.2],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'icon-opacity': 0.7,
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 15,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'town']],
      layout: {
        'icon-image': {
          base: 1,
          stops: [
            [0, 'circle-11'],
            [8, ''],
          ],
        },
        'icon-size': 0.4,
        'text-anchor': {
          base: 1,
          stops: [
            [0, 'left'],
            [8, 'center'],
          ],
        },
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'left',
        'text-offset': [0.5, 0.2],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'icon-opacity': 0.7,
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 14,
      filter: [
        'all',
        ['==', '$type', 'Point'],
        ['all', ['!=', 'capital', 2], ['==', 'class', 'city'], ['>', 'rank', 3]],
      ],
      layout: {
        'icon-image': {
          base: 1,
          stops: [
            [0, 'circle-11'],
            [8, ''],
          ],
        },
        'icon-size': 0.4,
        'text-anchor': {
          base: 1,
          stops: [
            [0, 'left'],
            [8, 'center'],
          ],
        },
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'left',
        'text-offset': [0.5, 0.2],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'icon-opacity': 0.7,
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_capital',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 12,
      filter: ['all', ['==', '$type', 'Point'], ['all', ['==', 'capital', 2], ['==', 'class', 'city']]],
      layout: {
        'icon-image': {
          base: 1,
          stops: [
            [0, 'star-11'],
            [8, ''],
          ],
        },
        'icon-size': 1,
        'text-anchor': {
          base: 1,
          stops: [
            [0, 'left'],
            [8, 'center'],
          ],
        },
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'left',
        'text-offset': [0.5, 0.2],
        'text-size': 14,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'icon-opacity': 0.7,
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_city_large',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 12,
      filter: [
        'all',
        ['==', '$type', 'Point'],
        ['all', ['!=', 'capital', 2], ['<=', 'rank', 3], ['==', 'class', 'city']],
      ],
      layout: {
        'icon-image': {
          base: 1,
          stops: [
            [0, 'circle-11'],
            [8, ''],
          ],
        },
        'icon-size': 0.4,
        'text-anchor': {
          base: 1,
          stops: [
            [0, 'left'],
            [8, 'center'],
          ],
        },
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-justify': 'left',
        'text-offset': [0.5, 0.2],
        'text-size': 14,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'icon-opacity': 0.7,
        'text-color': 'rgb(117, 129, 145)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_state',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 12,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'state']],
      layout: {
        'text-field': '{name:latin}\n{name:nonlatin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-size': 10,
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': 'rgb(113, 129, 144)',
        'text-halo-blur': 1,
        'text-halo-color': 'rgb(242,243,240)',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place_country_other',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 8,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'country'], ['!has', 'iso_a2']],
      layout: {
        'text-field': '{name:latin}',
        'text-font': ['Metropolis Light Italic', 'Open Sans Italic'],
        'text-size': {
          base: 1,
          stops: [
            [0, 9],
            [6, 11],
          ],
        },
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': {
          base: 1,
          stops: [
            [3, 'rgb(157,169,177)'],
            [4, 'rgb(153, 153, 153)'],
          ],
        },
        'text-halo-color': 'rgba(236,236,234,0.7)',
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'place_country_minor',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 8,
      filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'country'], ['>=', 'rank', 2], ['has', 'iso_a2']],
      layout: {
        'text-field': '{name:latin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-size': {
          base: 1,
          stops: [
            [0, 10],
            [6, 12],
          ],
        },
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': {
          base: 1,
          stops: [
            [3, 'rgb(157,169,177)'],
            [4, 'rgb(153, 153, 153)'],
          ],
        },
        'text-halo-color': 'rgba(236,236,234,0.7)',
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'place_country_major',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 6,
      filter: ['all', ['==', '$type', 'Point'], ['<=', 'rank', 1], ['==', 'class', 'country'], ['has', 'iso_a2']],
      layout: {
        'text-anchor': 'center',
        'text-field': '{name:latin}',
        'text-font': ['Metropolis Regular', 'Open Sans Regular'],
        'text-size': {
          base: 1.4,
          stops: [
            [0, 10],
            [3, 12],
            [4, 14],
          ],
        },
        'text-transform': 'uppercase',
        visibility: 'visible',
      },
      paint: {
        'text-color': {
          base: 1,
          stops: [
            [3, 'rgb(157,169,177)'],
            [4, 'rgb(153, 153, 153)'],
          ],
        },
        'text-halo-color': 'rgba(236,236,234,0.7)',
        'text-halo-width': 1.4,
      },
    },
  ],
  id: 'obsLight',
}
export default obsLight
