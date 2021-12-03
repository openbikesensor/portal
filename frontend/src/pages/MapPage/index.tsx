import React, {useState, useCallback} from 'react'
import _ from 'lodash'
import {Layer, Source} from 'react-map-gl'

import {Page, Map} from 'components'
import {useConfig} from 'config'

import {roadsLayer} from '../../mapstyles'

import RoadInfo from './RoadInfo'
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

  if (!obsMapSource) {
    return null
  }

  return (
    <Page fullScreen>
      <div className={styles.mapContainer}>
        <Map viewportFromUrl onClick={onClick}>
          <Source id="obs" {...obsMapSource}>
            <Layer {...roadsLayer} />
          </Source>

          <RoadInfo {...{clickLocation}} />
        </Map>
      </div>
    </Page>
  )
}
