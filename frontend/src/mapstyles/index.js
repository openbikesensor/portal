import produce from 'immer'

import obsLight from './obsLight'
import bright from './bright.json'
import positron from './positron.json'
import darkmatter from './darkmatter.json'

import baseColorMap from 'colormap/res/res/plasma'

export {bright, positron, darkmatter, obsLight}
export const baseMapStyles = {bright, positron, darkmatter, obsLight}

function simplifyColormap(colormap, maxCount = 16) {
  const result = []
  const step = Math.ceil(colormap.length / maxCount)
  for (let i = 0; i < colormap.length; i += step) {
    result.push(colormap[i])
  }
  return result
}

function rgbArrayToColor(arr) {
  return ['rgb', ...arr.map((v) => Math.round(v * 255))]
}

function rgbArrayToHtml(arr) {
  return (
    '#' +
    arr
      .map((v) => Math.round(v * 255).toString(16))
      .map((v) => (v.length === 1 ? '0' : '') + v)
      .join('')
  )
}

export function colormapToScale(colormap, value, min, max) {
  return [
    'interpolate-hcl',
    ['linear'],
    value,
    ...colormap.flatMap((v, i, a) => [(i / (a.length - 1)) * (max - min) + min, v]),
  ]
}

export const baseColormapSimple = simplifyColormap(baseColorMap.map(rgbArrayToColor))
export const baseColormapSimpleHtml = simplifyColormap(baseColorMap.map(rgbArrayToHtml))
export const grayscale = ['#FFFFFF', '#000000']
export const reds = ['rgba( 255, 0, 0, 0)', 'rgba( 255, 0, 0, 255)']
export const DARK_RED = 'rgba(150, 0, 0, 1)'
export const RED = 'rgba(255, 0, 0, 1)'
export const YELLOW = 'rgba(255, 220, 0, 1)'
export const GREEN = 'rgba(67, 200, 0, 1)'
export const DARK_GREEN = 'rgba(67, 150, 0, 1)'

const COLOR_RURAL = 'cyan'
const COLOR_URBAN = 'blue'
const COLOR_UNKNOWN_ZONE = 'purple'

export function colorByCount(attribute = 'event_count', maxCount, colormap = baseColormapSimple) {
  return colormapToScale(colormap, ['case', isValidAttribute(attribute), ['get', attribute], 0], 0, maxCount)
}

function zipStepped(arr1, arr2) {
  let max = Math.max(arr1.length, arr2.length)
  const arr = []
  for (let i = 0; i < max; i++) {
    if (arr1.length > i) {
      arr.push(arr1[i])
    }
    if (arr2.length > i) {
      arr.push(arr2[i])
    }
  }
  return arr
}

export const DISTANCE_STEPS_RURAL = [1.6, 1.8, 2.0, 2.2]
export const DISTANCE_STEPS_URBAN = [1.1, 1.3, 1.5, 1.7]
export const DISTANCE_COLORS = [DARK_RED, RED, YELLOW, GREEN, DARK_GREEN]
export const COLORMAP_RURAL = zipStepped(DISTANCE_COLORS, DISTANCE_STEPS_RURAL)
export const COLORMAP_URBAN = zipStepped(DISTANCE_COLORS, DISTANCE_STEPS_URBAN)
export const COLORMAP_LEGAL = zipStepped(DISTANCE_COLORS.toReversed(), [0.2, 0.4, 0.6, 0.8])

export function isValidAttribute(attribute) {
  if (attribute.endsWith('zone')) {
    return ['in', ['get', attribute], ['literal', ['rural', 'urban']]]
  }
  if (attribute === 'combined_score' || attribute === 'overtaking_frequency') {
    return ['to-boolean', ['get', 'overtaking_event_count']]
  }
  if (attribute === 'overtaking_legality') {
    // Percentage is useless with just 1 or 2 events
    return ['>=', ['get', 'overtaking_event_count'], 5]
  }
  return ['to-boolean', ['get', attribute]]
}

export const COLOR_BY_ZONE = ['match', ['get', 'zone'], 'rural', COLOR_RURAL, 'urban', COLOR_URBAN, COLOR_UNKNOWN_ZONE]

export function colorByDistance(attribute = 'distance_overtaker_mean', fallback = '#ABC') {
  return [
    'case',
    ['!', isValidAttribute(attribute)],
    fallback,
    [
      'match',
      ['get', 'zone'],
      'rural',
      ['step', ['get', attribute], ...COLORMAP_RURAL],
      ['step', ['get', attribute], ...COLORMAP_URBAN],
    ],
  ]
}

export const COUNT_PER_KILOMETER_USAGE = [
  '/',
  ['get', 'overtaking_event_count'],
  ['*', ['get', 'usage_count'], ['get', 'segment_length'], 0.001],
]

export const RATIO_ILLEGAL = ['/', ['get', 'overtaking_events_below_150'], ['get', 'overtaking_event_count']]
export const COLOR_LEGALITY = ['step', RATIO_ILLEGAL, ...COLORMAP_LEGAL]

export const COLOR_FREQUENCY = colormapToScale(baseColormapSimple, COUNT_PER_KILOMETER_USAGE, 0, 10)

export const COLOR_COMBINED_SCORE = [
  'case',

  ['<', COUNT_PER_KILOMETER_USAGE, 3],
  ['case', ['<', RATIO_ILLEGAL, 0.5], GREEN, YELLOW],

  ['<', COUNT_PER_KILOMETER_USAGE, 6],
  ['case', ['<', RATIO_ILLEGAL, 0.25], GREEN, ['<', RATIO_ILLEGAL, 0.5], YELLOW, RED],

  ['case', ['<', RATIO_ILLEGAL, 0.25], YELLOW, RED],
]

export const trackLayer = {
  type: 'line',
  paint: {
    'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 5],
    'line-color': '#F06292',
    'line-opacity': 0.6,
  },
}

export const getRegionLayers = (adminLevel = 6, baseColor = '#00897B', maxValue = 5000) => [
  {
    id: 'region',
    type: 'fill',
    source: 'obs',
    'source-layer': 'obs_regions',
    minzoom: 0,
    maxzoom: 10,
    // filter: [">", "overtaking_event_count", 0],
    paint: {
      'fill-color': baseColor,
      'fill-antialias': true,
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['log10', ['max', ['get', 'overtaking_event_count'], 1]],
        0,
        0,
        Math.log10(maxValue),
        0.9,
      ],
    },
  },
  {
    id: 'region-border',
    type: 'line',
    source: 'obs',
    'source-layer': 'obs_regions',
    minzoom: 0,
    maxzoom: 10,
    // filter: [">", "overtaking_event_count", 0],
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['log10', ['max', ['get', 'overtaking_event_count'], 1]],
        0,
        0.2,
        Math.log10(maxValue),
        1.5,
      ],
      'line-color': baseColor,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  },
]

export const trackLayerRaw = produce(trackLayer, (draft) => {
  // draft.paint['line-color'] = '#81D4FA'
  draft.paint['line-width'][4] = 1
  draft.paint['line-width'][6] = 2
  draft.paint['line-dasharray'] = [3, 3]
  delete draft.paint['line-opacity']
})

export const basemap = obsLight
