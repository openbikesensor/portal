import _ from 'lodash'

import bright from './bright.json'
import positron from './positron.json'

export {bright, positron}
export const baseMapStyles = {bright, positron}

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
  }
}

export const basemap = positron
