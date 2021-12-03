import React, {useState, useCallback} from 'react'
import _ from 'lodash'
import {Sidebar, Button} from 'semantic-ui-react'
import {Layer, Source} from 'react-map-gl'

import {Page, Map} from 'components'
import {useConfig} from 'config'

import {roadsLayer} from '../../mapstyles'

import RoadInfo from './RoadInfo'
import LayerSidebar from './LayerSidebar'
import styles from './styles.module.less'

export default function MapPage() {
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

  if (!obsMapSource) {
    return null
  }

  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        {layerSidebar && <div className={styles.mapSidebar}><LayerSidebar /></div>}
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
              <Layer {...roadsLayer} />
            </Source>

            <RoadInfo {...{clickLocation}} />
          </Map>
        </div>
      </div>
    </Page>
  )
}
