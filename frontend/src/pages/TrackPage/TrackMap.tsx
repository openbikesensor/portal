import React from 'react'
import {Source, Layer, Marker} from 'react-map-gl/maplibre'

import type {TrackData} from 'types'
import {Map} from 'components'

import {colorByDistance, trackLayer, trackLayerRaw} from '../../mapstyles'

export default function TrackMap({
  trackData,
  marker,
  showTrack = true,
  showPoints = true,
  ...props
}: {
  trackData: TrackData
  showTrack: boolean
  showPoints: boolean
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

        <Marker
        longitude= {marker.longitude}
        latitude= {marker.latitude}
          ><div>
  <svg width="30" height="30">
    <circle cx="15" cy="15" r="3" stroke="red" fill="red" />


  </svg>
  </div></Marker>



        {showPoints && (
          <Source key="events" id="events" type="geojson" data={trackData.events}>
            <Layer
              id="events"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 10],
                'circle-color': colorByDistance('distance_overtaker'),
              }}
            />

            {['distance_overtaker', 'distance_stationary'].map((property) => (
              <Layer
                key={property}
                {...{
                  id: property,
                  type: 'symbol',
                  minzoom: 15,
                  layout: {
                    'text-field': [
                      'number-format',
                      ['get', property],
                      {'min-fraction-digits': 2, 'max-fraction-digits': 2},
                    ],
                    'text-allow-overlap': true,
                    'text-size': 14,
                    'text-keep-upright': false,
                    'text-anchor': property === 'distance_overtaker' ? 'right' : 'left',
                    'text-radial-offset': 1,
                    'text-rotate': ['-', 90, ['*', 180, ['/', ['get', 'course'], Math.PI]]],
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
