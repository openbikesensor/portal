import React from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import {List, Select, Input, Divider, Checkbox} from 'semantic-ui-react'

import {
  MapConfig,
  setMapConfigFlag as setMapConfigFlagAction,
  initialState as defaultMapConfig,
} from 'reducers/mapConfig'

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

function LayerSidebar({
  mapConfig,
  setMapConfigFlag,
}: {
  mapConfig: MapConfig
  setMapConfigFlag: (flag: string, value: unknown) => void
}) {
  const {baseMap: {style}, obsRoads: {show, showUntagged, attribute, maxCount}} = mapConfig

  return (
    <div>
      <List>
        <List.Item>
          <List.Header>Basemap Style</List.Header>
          <Select
            options={BASEMAP_STYLE_OPTIONS}
            value={style}
            onChange={(_e, {value}) => setMapConfigFlag('baseMap.style', value)}
          />
        </List.Item>
        <Divider />
        <List.Item>
          <Checkbox
            checked={showUntagged}
            onChange={() => setMapConfigFlag('obsRoads.showUntagged', !showUntagged)}
            label="Untagged roads"
          />
        </List.Item>
        <Divider />
        <List.Item>
          <Checkbox
            checked={show}
            onChange={() => setMapConfigFlag('obsRoads.show', !show)}
            label="OBS Roads"
          />
        </List.Item>
        <List.Item>
          <List.Header>Color based on</List.Header>
          <Select
            fluid
            options={ROAD_ATTRIBUTE_OPTIONS}
            value={attribute}
            onChange={(_e, {value}) => setMapConfigFlag('obsRoads.attribute', value)}
          />
        </List.Item>
        {attribute.endsWith('_count') ? (
          <List.Item>
            <List.Header>Maximum value</List.Header>
            <Input
              fluid
              type="number"
              value={maxCount}
              onChange={(_e, {value}) => setMapConfigFlag('obsRoads.maxCount', value)}
            />
          </List.Item>
        ) : null}
      </List>
    </div>
  )
}

export default connect(
  (state) => ({
    mapConfig: _.merge(
      {},
      defaultMapConfig,
      (state as any).mapConfig as MapConfig,
      //
    ),
  }),
  {setMapConfigFlag: setMapConfigFlagAction}
  //
)(LayerSidebar)
