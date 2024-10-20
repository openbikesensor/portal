import React from 'react'
import _ from 'lodash'
import {List, Header, Grid} from 'semantic-ui-react'
import {Duration} from 'luxon'
import {useTranslation} from 'react-i18next'

import {FormattedDate, Visibility, Chart} from 'components'
import {formatDistance, formatDuration} from 'utils'

function transpose(matrix) {
  return matrix[0].map((col, i) => matrix.map(row => row[i]));
}

export default function TrackDetails({trackData, updateMarker}) {
    if (!trackData) {
    return null
  }

  function get_index(datetime) {
      return trackData.fullData['datetime'].indexOf(datetime);
    }


  function handleMouseMove(param) {
    const index = get_index(param.data[0]);
    updateMarker({'latitude' : trackData.fullData.latitude[index],
              'longitude' : trackData.fullData.longitude[index],
              'datetime' : param.data[0]
              })
  }
   const mouseMove = React.useCallback((event) => {
      handleMouseMove(event)
    }, [] );

const distance_overtaker = transpose( [trackData.fullData['datetime'],trackData.fullData['distance_overtaker']])
const distance_stationary = transpose( [trackData.fullData['datetime'],trackData.fullData['distance_stationary']])
const speed = transpose( [trackData.fullData['datetime'],trackData.fullData['speed']])
//const speed = transpose( [trackData.fullData['datetime'],trackData.fullData['speed']])

  return (

    <Chart
      style={{height: 300}}
      onEvents={{
    'mouseMove': mouseMove,
    }}
      option={ {
  xAxis: {scale:true},
  yAxis: {scale:true},
  tooltip: {show:true},

  series: [
    {
      symbolSize: 4,
      data: distance_overtaker,
      type: 'scatter'
    },
  {
      symbolSize: 4,
      data: speed,
      type: 'scatter'
    },
    {
      symbolSize: 4,
      data: distance_stationary,
      type: 'scatter'
    }
  ]
}
}
    >
    </Chart>
  )
}
