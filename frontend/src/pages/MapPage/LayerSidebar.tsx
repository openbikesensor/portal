import React from 'react'
import {connect} from 'react-redux'
import {List, Select, Header, Checkbox} from 'semantic-ui-react'

import * as mapConfigActions from 'reducers/mapConfig'

const BASEMAP_STYLE_OPTIONS = [
  {value: 'positron', key: 'positron', text: 'Positron'},
  {value: 'bright', key: 'bright', text: 'OSM Bright'},
]

const ROAD_ATTRIBUTE_OPTIONS = [
  {value: 'distance_overtaker_mean', key: 'distance_overtaker_mean', text: 'Overtaker distance mean'},
  {value: 'distance_overtaker_min', key: 'distance_overtaker_min', text: 'Overtaker distance minimum'},
  {value: 'distance_overtaker_max', key: 'distance_overtaker_max', text: 'Overtaker distance maximum'},
  {value: 'distance_overtaker_median', key: 'distance_overtaker_median', text: 'Overtaker distance median'},
  {value: 'overtaking_event_count', key: 'overtaking_event_count', text: 'Event count'},
]

function LayerSidebar({mapConfig, setMapConfigFlag}) {
  const showUntagged = mapConfig?.obsRoads?.showUntagged ?? true

  return (
    <div>
      <List>
        <List.Item>
          <List.Header>Basemap Style</List.Header>
          <Select
            options={BASEMAP_STYLE_OPTIONS}
            value={mapConfig?.baseMap?.style ?? 'positron'}
            onChange={(_e, {value}) => setMapConfigFlag('baseMap.style', value)}
          />
        </List.Item>
        <Header as='h4' dividing>OBS Roads</Header>
        <List.Item>
          <Checkbox label='Show untagged roads' checked={showUntagged}
            onChange={() => setMapConfigFlag('obsRoads.showUntagged', !showUntagged)}
          />
        </List.Item>
        <List.Item>
          <List.Header style={{marginBlock: 8}}>Color based on</List.Header>
          <Select
            fluid
            options={ROAD_ATTRIBUTE_OPTIONS}
            value={mapConfig?.obsRoads?.attribute ?? 'distance_overtaker_mean'}
            onChange={(_e, {value}) => setMapConfigFlag('obsRoads.attribute', value)}
          />
        </List.Item>
      </List>
    </div>
  )
}

export default connect((state) => ({mapConfig: state.mapConfig}), mapConfigActions)(LayerSidebar)
