import _ from 'lodash'

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

export function colormapToScale(colormap, value, min, max) {
  return [
    'interpolate-hcl',
    ['linear'],
    value,
    ...colormap.flatMap((v, i, a) => [(i / (a.length - 1)) * (max - min) + min, v]),
  ]
}

export const viridis = simplifyColormap(viridisBase.map(rgbArrayToColor), 20)
export const grayscale = ['#FFFFFF', '#000000']
export const reds = [
  'rgba( 255, 0, 0, 0)',
  'rgba( 255, 0, 0, 255)',
]

export function colorByCount(attribute = 'event_count', maxCount, colormap = viridis) {
  return colormapToScale(colormap, ['case', ['to-boolean', ['get', attribute]], ['get', attribute], 0], 0, maxCount)
}

export function colorByDistance(attribute = 'distance_overtaker_mean', fallback = '#ABC') {
  return [
    'case',
    ['!', ['to-boolean', ['get', attribute]]],
    fallback,
    [
      'interpolate-hcl',
      ['linear'],
      ['get', attribute],
      1,
      'rgba(255, 0, 0, 1)',
      1.3,
      'rgba(255, 200, 0, 1)',
      1.5,
      'rgba(67, 200, 0, 1)',
      1.7,
      'rgba(67, 150, 0, 1)',
    ],
  ]
}

export const trackLayer = {
  type: 'line',
  paint: {
    'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 5],
    'line-color': '#F06292',
  },
}

export const basemap = positron
