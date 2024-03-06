import _ from 'lodash'
import produce from 'immer'

import bright from './bright.json'
import positron from './positron.json'

import viridisBase from 'colormap/res/res/viridis'

export {bright, positron}
export const baseMapStyles = {bright, positron}

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
      .map((v) => (v.length == 1 ? '0' : '') + v)
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

export const viridis = simplifyColormap(viridisBase.map(rgbArrayToColor), 20)
export const viridisSimpleHtml = simplifyColormap(viridisBase.map(rgbArrayToHtml), 10)
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

export function colorByCount(attribute = 'event_count', maxCount, colormap = viridis) {
  return colormapToScale(colormap, ['case', isValidAttribute(attribute), ['get', attribute], 0], 0, maxCount)
}

var steps = {rural: [1.6, 1.8, 2.0, 2.2], urban: [1.1, 1.3, 1.5, 1.7]}

export function isValidAttribute(attribute) {
  if (attribute.endsWith('zone')) {
    return ['in', ['get', attribute], ['literal', ['rural', 'urban']]]
  }
  if (attribute === 'combined_score') {
    return ['to-boolean', ['get', 'overtaking_event_count']]
  }
  return ['to-boolean', ['get', attribute]]
}

export function borderByZone() {
  return ['match', ['get', 'zone'], 'rural', COLOR_RURAL, 'urban', COLOR_URBAN, COLOR_UNKNOWN_ZONE]
}

export function colorByDistance(attribute = 'distance_overtaker_mean', fallback = '#ABC', zone = 'urban') {
  return [
    'case',
    ['!', isValidAttribute(attribute)],
    fallback,
    [
      'match',
      ['get', 'zone'],
      'rural',
      [
        'step',
        ['get', attribute],
        DARK_RED,
        steps['rural'][0],
        RED,
        steps['rural'][1],
        YELLOW,
        steps['rural'][2],
        GREEN,
        steps['rural'][3],
        DARK_GREEN,
      ],
      [
        'step',
        ['get', attribute],
        DARK_RED,
        steps['urban'][0],
        RED,
        steps['urban'][1],
        YELLOW,
        steps['urban'][2],
        GREEN,
        steps['urban'][3],
        DARK_GREEN,
      ],
    ],
  ]
}

const class0 = GREEN
const class1 = YELLOW
const class2 = RED

export const COMBINED_SCORE_THRESHOLDS_ILLEGAL = [0.25, 0.5, 0.75] // percentage illegal
export const COMBINED_SCORE_THRESHOLDS_FREQUENCY = [0.003, 0.006] // events per meter usage
export const COMBINED_SCORE_MATRIX = [
  [class0, class0, class1],
  [class0, class1, class2],
  [class1, class2, class2],
  [class1, class2, class2],
]

export function colorCombinedScore() {
  const countPerMeterUsage = [
    '/',
    ['get', 'overtaking_event_count'],
    ['*', ['get', 'usage_count'], ['get', 'segment_length']],
  ]

  // TODO: introduce legal limit, not just use 150cm

  const rationIllegal = ['/', ['get', 'overtaking_events_below_150'], ['get', 'overtaking_event_count']]

  const [t0, t1, t2] = COMBINED_SCORE_THRESHOLDS_ILLEGAL
  const [f0, f1] = COMBINED_SCORE_THRESHOLDS_FREQUENCY

  return [
    'case',

    ['<', countPerMeterUsage, f0],
    ['case', ['<', rationIllegal, t1], class0, class1],

    ['<', countPerMeterUsage, f1],
    ['case', ['<', rationIllegal, t0], class0, ['<', rationIllegal, t1], class1, class2],

    ['case', ['<', rationIllegal, t0], class1, class2],
  ]
}

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

export const basemap = positron
