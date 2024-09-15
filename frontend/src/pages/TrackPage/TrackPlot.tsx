import React from 'react'
import _ from 'lodash'
import {List, Header, Grid} from 'semantic-ui-react'
import {Duration} from 'luxon'
import {useTranslation} from 'react-i18next'

import {FormattedDate, Visibility, Chart} from 'components'
import {formatDistance, formatDuration} from 'utils'

export default function TrackDetails({trackPlot}) {


  return (
    <Chart
      style={{height: 400}}
      option={ {
  xAxis: {},
  yAxis: {},
  series: [
    {
      symbolSize: 4,
      data: trackPlot,
      type: 'scatter'
    }
  ]
}
}
    />
  )
}
