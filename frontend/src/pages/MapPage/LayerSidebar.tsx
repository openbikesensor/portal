import React from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import {List, Select, Input, Divider, Checkbox, Header} from 'semantic-ui-react'

import {
  MapConfig,
  setMapConfigFlag as setMapConfigFlagAction,
  initialState as defaultMapConfig,
} from 'reducers/mapConfig'
import {colorByDistance} from 'mapstyles'
import {ColorMapLegend} from 'components'

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
  const {
    baseMap: {style},
    obsRoads: {show: showRoads, showUntagged, attribute, maxCount},
    obsEvents: {show: showEvents},
  } = mapConfig

  return (
    <div>
      <List relaxed>
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
            toggle
            size="small"
            id="obsRoads.show"
            style={{float: 'right'}}
            checked={showRoads}
            onChange={() => setMapConfigFlag('obsRoads.show', !showRoads)}
          />
          <label htmlFor="obsRoads.show">
            <Header as="h4">Road segments</Header>
          </label>
        </List.Item>
        {showRoads && (
          <>
            <List.Item>
              <Checkbox
                checked={showUntagged}
                onChange={() => setMapConfigFlag('obsRoads.showUntagged', !showUntagged)}
                label="Include roads without data"
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
          </>
        )}
        {showRoads && (
          <>
            <List.Item>
              <ColorMapLegend map={_.chunk(colorByDistance('distance_overtaker')[3].slice(3), 2)} />
            </List.Item>
          </>
        )}
        <Divider />
        <List.Item>
          <Checkbox
            toggle
            size="small"
            id="obsEvents.show"
            style={{float: 'right'}}
            checked={showEvents}
            onChange={() => setMapConfigFlag('obsEvents.show', !showEvents)}
          />
          <label htmlFor="obsEvents.show">
            <Header as="h4">Event points</Header>
          </label>
        </List.Item>
        {showEvents && (
          <>
            <List.Item>
              <ColorMapLegend map={_.chunk(colorByDistance('distance_overtaker')[3].slice(3), 2)} />
            </List.Item>
          </>
        )}
      </List>
    </div>
  )
}

export default connect(
  (state) => ({
    mapConfig: _.merge(
      {},
      defaultMapConfig,
      (state as any).mapConfig as MapConfig
      //
    ),
  }),
  {setMapConfigFlag: setMapConfigFlagAction}
  //
)(LayerSidebar)
