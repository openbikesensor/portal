import React from 'react'
import {connect} from 'react-redux'
import {List, Select} from 'semantic-ui-react'

import * as mapConfigActions from 'reducers/mapConfig'

const BASEMAP_STYLE_OPTIONS = [
  {key: 'positron', value: 'positron', text: 'Positron'},
  {key: 'bright', value: 'bright', text: 'OSM Bright'},
]

function LayerSidebar({mapConfig, setBasemapStyle}) {
  return (
    <div>
      <List>
        <List.Item>
          <List.Header>Basemap Style</List.Header>
          <Select
            options={BASEMAP_STYLE_OPTIONS}
            value={mapConfig?.baseMap?.style ?? 'positron'}
            onChange={(_e, {value}) => setBasemapStyle(value)}
          />
        </List.Item>
      </List>
    </div>
  )
}

export default connect((state) => ({mapConfig: state.mapConfig}), mapConfigActions)(LayerSidebar)
