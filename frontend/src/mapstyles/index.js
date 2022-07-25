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
  return "#" + arr.map((v) => Math.round(v * 255).toString(16)).map(v => (v.length == 1 ? '0' : '') + v).join('')
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
export const reds = [
  'rgba( 255, 0, 0, 0)',
  'rgba( 255, 0, 0, 255)',
]

export function colorByCount(attribute = 'event_count', maxCount, colormap = viridis) {
  return colormapToScale(colormap, ['case', ['to-boolean', ['get', attribute]], ['get', attribute], 0], 0, maxCount)
}

var steps = {'rural': [1.6,1.8,2.0,2.2],
             'urban': [1.1,1.3,1.5,1.7]}

export function borderByZone() {
  return ["match", ['get', 'zone'],
  "rural", "cyan",
  "urban", "blue",
  "purple"
  ]
}

export function colorByDistance(attribute = 'distance_overtaker_mean', fallback = '#ABC', zone='urban') {

  return [
    'case',
    ['!', ['to-boolean', ['get', attribute]]],
    fallback,
    ["match", ['get', 'zone'], "rural",
    [
      'step',
      ['get', attribute],
      'rgba(150, 0, 0, 1)',
      steps['rural'][0],
      'rgba(255, 0, 0, 1)',
      steps['rural'][1],
      'rgba(255, 220, 0, 1)',
      steps['rural'][2],
      'rgba(67, 200, 0, 1)',
      steps['rural'][3],
      'rgba(67, 150, 0, 1)',
    ], "urban",
    [
      'step',
      ['get', attribute],
      'rgba(150, 0, 0, 1)',
      steps['urban'][0],
      'rgba(255, 0, 0, 1)',
      steps['urban'][1],
      'rgba(255, 220, 0, 1)',
      steps['urban'][2],
      'rgba(67, 200, 0, 1)',
      steps['urban'][3],
      'rgba(67, 150, 0, 1)',
    ],
    [
      'step',
      ['get', attribute],
      'rgba(150, 0, 0, 1)',
      steps['urban'][0],
      'rgba(255, 0, 0, 1)',
      steps['urban'][1],
      'rgba(255, 220, 0, 1)',
      steps['urban'][2],
      'rgba(67, 200, 0, 1)',
      steps['urban'][3],
      'rgba(67, 150, 0, 1)',
    ]
    ]
  ]
}

export const trackLayer = {
  type: 'line',
  paint: {
    'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 5],
    'line-color': '#F06292',
  },
}

export const trackLayerRaw = produce(trackLayer, draft => {
  draft.paint['line-color'] = '#81D4FA'
  draft.paint['line-width'][4] = 1
  draft.paint['line-width'][6] = 3
})

export const basemap = positron
