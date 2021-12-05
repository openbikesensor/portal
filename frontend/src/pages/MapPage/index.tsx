import React, {useState, useCallback, useMemo} from 'react'
import _ from 'lodash'
import {Button} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl'
import produce from 'immer'
import {connect} from 'react-redux'

import {Page, Map} from 'components'
import {useConfig} from 'config'
import {colorByDistance, colorByCount, reds} from 'mapstyles'

import RoadInfo from './RoadInfo'
import LayerSidebar from './LayerSidebar'
import styles from './styles.module.less'

const untaggedRoadsLayer = {
  id: 'obs_roads_untagged',
  type: 'line',
  source: 'obs',
  'source-layer': 'obs_roads',
  filter: ['!', ['to-boolean', ['get', 'distance_overtaker_mean']]],
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 2, 17, 2],
    'line-color': '#ABC',
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1],
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
  minzoom: 12,
}

const getRoadsLayer = (colorAttribute, maxCount) =>
  produce(untaggedRoadsLayer, (draft) => {
    draft.id = 'obs_roads_normal'
    if (colorAttribute.endsWith('_count')) {
      delete draft.filter
    } else {
      draft.filter = draft.filter[1] // remove '!'
    }
      draft.paint['line-width'][6] = 6 // scale bigger on zoom
    draft.paint['line-color'] = colorAttribute.startsWith('distance_')
      ? colorByDistance(colorAttribute)
      : colorAttribute.endsWith('_count')
      ? colorByCount(colorAttribute, maxCount, reds)
      : '#DDD'
    draft.paint['line-opacity'][3] = 12
    draft.paint['line-opacity'][5] = 13
  })

function MapPage({mapConfig}) {
  const {obsMapSource} = useConfig() || {}
  const [clickLocation, setClickLocation] = useState<{longitude: number; latitude: number} | null>(null)

  const onClick = useCallback(
    (e) => {
      let node = e.target
      while (node) {
        if (node?.classList?.contains(styles.mapInfoBox)) {
          return
        }
        node = node.parentNode
      }

      setClickLocation({longitude: e.lngLat[0], latitude: e.lngLat[1]})
    },
    [setClickLocation]
  )

  const [layerSidebar, setLayerSidebar] = useState(true)

  const showUntagged = mapConfig?.obsRoads?.showUntagged ?? true
  const roadsLayerColorAttribute = mapConfig?.obsRoads?.attribute ?? 'distance_overtaker_mean'
  const roadsLayerMaxCount = mapConfig?.obsRoads?.maxCount ?? 20
  const roadsLayer = useMemo(() => getRoadsLayer(roadsLayerColorAttribute, roadsLayerMaxCount), [
    roadsLayerColorAttribute,
    roadsLayerMaxCount,
  ])

  if (!obsMapSource) {
    return null
  }

  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        {layerSidebar && (
          <div className={styles.mapSidebar}>
            <LayerSidebar />
          </div>
        )}
        <div className={styles.map}>
          <Map viewportFromUrl onClick={onClick}>
            <Button
              style={{
                position: 'absolute',
                left: 44,
                top: 9,
              }}
              primary
              icon="bars"
              active={layerSidebar}
              onClick={() => setLayerSidebar(layerSidebar ? false : true)}
            />
            <Source id="obs" {...obsMapSource}>
              {showUntagged && <Layer key={untaggedRoadsLayer.id} {...untaggedRoadsLayer} />}
              <Layer key={roadsLayer.id} {...roadsLayer} />
            </Source>

            <RoadInfo {...{clickLocation}} />
          </Map>
        </div>
      </div>
    </Page>
  )
}

export default connect((state) => ({mapConfig: state.mapConfig}))(MapPage)
