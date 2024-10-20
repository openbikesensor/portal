import React, {useState, useCallback, useMemo, useRef} from 'react'
import {connect} from 'react-redux'
import {Button} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl/maplibre'
import produce from 'immer'
import classNames from 'classnames'

import api from 'api'
import {Page, Map} from 'components'
import {useConfig} from 'config'
import {
  colorByDistance,
  colorByCount,
  getRegionLayers,
  COLOR_BY_ZONE,
  isValidAttribute,
  COLOR_COMBINED_SCORE,
  COLOR_LEGALITY,
  COLOR_FREQUENCY,
} from 'mapstyles'
import {useMapConfig} from 'reducers/mapConfig'

import RoadInfo, {RoadInfoType} from './RoadInfo'
import RegionInfo from './RegionInfo'
import LayerSidebar from './LayerSidebar'
import styles from './styles.module.less'

const untaggedRoadsLayer = {
  id: 'obs_roads_untagged',
  type: 'line',
  source: 'obs',
  'source-layer': 'obs_roads',
  minzoom: 12,
  filter: ['!', ['to-boolean', ['get', 'distance_overtaker_mean']]],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1, 17, 2],
    'line-color': '#ABC',
    // "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
    'line-offset': [
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      12,
      ['get', 'offset_direction'],
      19,
      ['*', ['get', 'offset_direction'], 8],
    ],
  },
}

const getMyTracksLayer = (dark?: boolean) => ({
  id: 'tracks',
  type: 'line',
  source: 'obs',
  'source-layer': 'obs_tracks',
  minzoom: 12,
  paint: {
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 17, 1],
    'line-color': dark ? 'hsla(50, 100%, 50%, 0.3)' : 'hsla(210, 100%, 30%, 0.3)',
  },
})

/*
// You can add this layer to the map to debug attributes or computed values on
// the road segments in the tiles.

const roadAttributesTextLayer = {
  id: 'road-attributes',
  type: 'symbol',
  source: 'obs',
  'source-layer': 'obs_roads',
  minzoom: 12,
  filter: ['to-boolean', ['get', 'distance_overtaker_mean']],
  layout: {
    'symbol-placement': 'line',
    'text-field': [
      'number-format',
      ['get', 'usage_count'],
      // ['get', 'distance_overtaker_mean'],
      {'min-fraction-digits': 0, 'max-fraction-digits': 2},
    ],
    'text-offset': [0, 1],
    'text-font': ['Noto Sans Bold'],
    'text-rotation-alignment': 'map',
    // 'text-rotate': 90,
    'text-size': 18,
  },
  paint: {
    'text-color': 'hsl(30, 23%, 42%)',
    'text-halo-color': '#f8f4f0',
    'text-halo-width': 0.5,
  },
}
*/

const getUntaggedRoadsLayer = (colorAttribute) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.filter = ['!', isValidAttribute(colorAttribute)]
  })

const getRoadsLayer = (colorAttribute, maxCount) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.id = 'obs_roads_normal'
    draft.filter = isValidAttribute(colorAttribute)
    draft.minzoom = 10
    draft.paint['line-width'][6] = 4 // scale bigger on zoom

    let color: any = '#DDD'

    if (colorAttribute === 'combined_score') {
      color = COLOR_COMBINED_SCORE
    } else if (colorAttribute === 'overtaking_legality') {
      color = COLOR_LEGALITY
    } else if (colorAttribute === 'overtaking_frequency') {
      color = COLOR_FREQUENCY
    } else if (colorAttribute.startsWith('distance_')) {
      color = colorByDistance(colorAttribute)
    } else if (colorAttribute.endsWith('_count') | colorAttribute.endsWith('_length')) {
      color = colorByCount(colorAttribute, maxCount)
    } else if (colorAttribute.endsWith('zone')) {
      color = COLOR_BY_ZONE
    }

    draft.paint['line-color'] = color
  })

const getEventsLayer = () => ({
  id: 'obs_events',
  type: 'circle',
  source: 'obs',
  'source-layer': 'obs_events',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 5],
    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.1, 9, 0.3, 10, 0.5, 11, 1],
    'circle-color': colorByDistance('distance_overtaker'),
  },
  minzoom: 8,
})

const getEventsTextLayer = () => ({
  id: 'obs_events_text',
  type: 'symbol',
  minzoom: 18,
  source: 'obs',
  'source-layer': 'obs_events',
  layout: {
    'text-field': [
      'number-format',
      ['get', 'distance_overtaker'],
      {'min-fraction-digits': 2, 'max-fraction-digits': 2},
    ],
    'text-allow-overlap': true,
    'text-size': 14,
    'text-keep-upright': false,
    'text-anchor': 'left',
    'text-radial-offset': 0.75,
    'text-rotate': ['-', 90, ['*', ['get', 'course'], 180 / Math.PI]],
    'text-rotation-alignment': 'map',
  },
  paint: {
    'text-halo-color': 'rgba(255, 255, 255, 1)',
    'text-halo-width': 1,
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.3, 1],
  },
})

interface RegionInfo {
  properties: {
    admin_level: number
    name: string
    overtaking_event_count: number
  }
}

type Details = {type: 'road'; road: RoadInfoType} | {type: 'region'; region: RegionInfo}

function MapPage({login}) {
  const {obsMapSource, banner} = useConfig() || {}
  const [details, setDetails] = useState<null | Details>(null)

  const onCloseDetails = useCallback(() => setDetails(null), [setDetails])

  const mapConfig = useMapConfig()

  const viewportRef = useRef()
  const mapInfoPortal = useRef()

  const onViewportChange = useCallback(
    (viewport) => {
      viewportRef.current = viewport
    },
    [viewportRef]
  )

  const onClick = useCallback(
    async (e) => {
      // check if we clicked inside the mapInfoBox, if so, early exit
      let node = e.target
      while (node) {
        if ([styles.mapInfoBox, styles.mapToolbar].some((className) => node?.classList?.contains(className))) {
          return
        }
        node = node.parentNode
      }

      const {zoom} = viewportRef.current

      if (zoom < 10) {
        const clickedRegion = e.features?.find((f) => f.source === 'obs' && f.sourceLayer === 'obs_regions')
        setDetails(clickedRegion ? {type: 'region', region: clickedRegion} : null)
      } else {
        const road = await api.get('/mapdetails/road', {
          query: {
            longitude: e.lngLat[0],
            latitude: e.lngLat[1],
            radius: 100,
          },
        })
        setDetails(road?.road ? {type: 'road', road} : null)
      }
    },
    [setDetails]
  )

  const [layerSidebar, setLayerSidebar] = useState(true)

  const {
    obsRoads: {attribute, maxCount},
  } = mapConfig

  const layers = [] // [roadAttributesTextLayer]

  const untaggedRoadsLayerCustom = useMemo(() => getUntaggedRoadsLayer(attribute), [attribute])
  if (mapConfig.obsRoads.show && mapConfig.obsRoads.showUntagged) {
    layers.push(untaggedRoadsLayerCustom)
  }

  const roadsLayer = useMemo(() => getRoadsLayer(attribute, Number(maxCount)), [attribute, maxCount])
  if (mapConfig.obsRoads.show) {
    layers.push(roadsLayer)
  }

  const regionLayers = useMemo(() => getRegionLayers(), [])
  if (mapConfig.obsRegions.show) {
    layers.push(...regionLayers)
  }

  if (mapConfig.obsTracks.show && login) {
    layers.push(getMyTracksLayer(mapConfig.baseMap.style === 'darkmatter'))
  }

  const eventsLayer = useMemo(() => getEventsLayer(), [])
  const eventsTextLayer = useMemo(() => getEventsTextLayer(), [])

  if (mapConfig.obsEvents.show) {
    layers.push(eventsLayer)
    layers.push(eventsTextLayer)
  }

  const onToggleLayerSidebarButtonClick = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      setLayerSidebar((v) => !v)
    },
    [setLayerSidebar]
  )

  if (!obsMapSource) {
    return null
  }

  const tiles = obsMapSource?.tiles?.map((tileUrl: string) => {
    const query = new URLSearchParams()
    if (login) {
      if (mapConfig.filters.currentUser) {
        query.append('user', login.id)
      }

      if (mapConfig.filters.dateMode === 'range') {
        if (mapConfig.filters.startDate) {
          query.append('start', mapConfig.filters.startDate)
        }
        if (mapConfig.filters.endDate) {
          query.append('end', mapConfig.filters.endDate)
        }
      } else if (mapConfig.filters.dateMode === 'threshold') {
        if (mapConfig.filters.startDate) {
          query.append(mapConfig.filters.thresholdAfter ? 'start' : 'end', mapConfig.filters.startDate)
        }
      }
    }
    const queryString = String(query)
    return tileUrl + (queryString ? '?' : '') + queryString
  })

  const hasFilters: boolean = login && (mapConfig.filters.currentUser || mapConfig.filters.dateMode !== 'none')

  return (
    <Page fullScreen title="Map">
      <div className={classNames(styles.mapContainer, banner ? styles.hasBanner : null)} ref={mapInfoPortal}>
        {layerSidebar && (
          <div className={styles.mapSidebar}>
            <LayerSidebar />
          </div>
        )}
        <div className={styles.map}>
          <Map viewportFromUrl onClick={onClick} hasToolbar onViewportChange={onViewportChange}>
            <div className={styles.mapToolbar}>
              <Button primary icon="bars" active={layerSidebar} onClick={onToggleLayerSidebarButtonClick} />
            </div>
            <Source id="obs" {...obsMapSource} tiles={tiles}>
              {layers.map((layer) => (
                <Layer key={layer.id} {...layer} />
              ))}
            </Source>

            {details?.type === 'road' && details?.road?.road && (
              <RoadInfo
                roadInfo={details.road}
                mapInfoPortal={mapInfoPortal.current}
                onClose={onCloseDetails}
                {...{hasFilters}}
              />
            )}

            {details?.type === 'region' && details?.region && (
              <RegionInfo region={details.region} mapInfoPortal={mapInfoPortal.current} onClose={onCloseDetails} />
            )}
          </Map>
        </div>
      </div>
    </Page>
  )
}

export default connect((state) => ({login: state.login}))(MapPage)
