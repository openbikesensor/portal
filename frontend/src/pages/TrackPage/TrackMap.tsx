import React from 'react'
import {Source, Layer} from 'react-map-gl'

import type {TrackData} from 'types'
import {Map} from 'components'

import {colorByDistance, trackLayer, trackLayerRaw} from '../../mapstyles'

export default function TrackMap({
  trackData,
  showTrack,
  pointsMode = 'overtakingEvents',
  side = 'overtaker',
  ...props
}: {
  trackData: TrackData
  showTrack: boolean
  pointsMode: 'none' | 'overtakingEvents' | 'measurements'
  side: 'overtaker' | 'stationary'
}) {
  if (!trackData) {
    return null
  }

  return (
    <div style={props.style}>
      <Map boundsFromJson={trackData.track}>
        {showTrack && trackData.trackRaw != null && (
          <Source key="trackRaw" id="trackRaw" type="geojson" data={trackData.trackRaw}>
            <Layer id="trackRaw" {...trackLayerRaw} />
          </Source>
        )}

        {showTrack && (
          <Source key="track" id="track" type="geojson" data={trackData.track}>
            <Layer id="track" {...trackLayer} />
          </Source>
        )}

        {pointsMode !== 'none' && (
          <Source key="overtakingEvents" id="overtakingEvents" type="geojson" data={trackData[pointsMode]}>
            <Layer
              id="overtakingEvents"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 10],
                'circle-color': colorByDistance('distance_' + side),
              }}
            />

            {[
              ['distance_overtaker', 'right'],
              ['distance_stationary', 'left'],
            ].map(([p, a]) => (
              <Layer
                key={p}
                {...{
                  id: p,
                  type: 'symbol',
                  minzoom: 15,
                  layout: {
                    'text-field': ['number-format', ['get', p], {'min-fraction-digits': 2, 'max-fraction-digits': 2}],
                    'text-allow-overlap': true,
                    'text-size': 14,
                    'text-keep-upright': false,
                    'text-anchor': a,
                    'text-radial-offset': 1,
                    'text-rotate': ['get', 'course'],
                    'text-rotation-alignment': 'map',
                  },
                  paint: {
                    'text-halo-color': 'rgba(255, 255, 255, 1)',
                    'text-halo-width': 1,
                    'text-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.3, 1],
                  },
                }}
              />
            ))}
          </Source>
        )}
      </Map>
    </div>
  )
}
