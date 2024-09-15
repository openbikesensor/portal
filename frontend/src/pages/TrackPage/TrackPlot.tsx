import React from 'react'
import _ from 'lodash'
import {List, Header, Grid} from 'semantic-ui-react'
import {Duration} from 'luxon'
import {useTranslation} from 'react-i18next'

import {FormattedDate, Visibility, Chart} from 'components'
import {formatDistance, formatDuration} from 'utils'

export default function TrackDetails({trackData}) {
console.log(trackData)
const data = trackData.fullData.data.map(function(a) {
    return [ a[7],  a[5]];
});
console.log(data);
  return (
    <Chart
      style={{height: 400}}
      option={ {
  xAxis: {scale:true},
  yAxis: {scale:true},
  series: [
    {
      symbolSize: 4,
      data: data,
      type: 'scatter'
    }
  ]
}
}
    />
  )
}
