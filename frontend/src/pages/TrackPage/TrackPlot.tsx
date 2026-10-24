import React from 'react'
import {useTranslation} from 'react-i18next'
import {Chart} from 'components'

function transpose(matrix) {
  return matrix[0].map((col, i) => matrix.map(row => row[i]));
}

export default function TrackDetails({trackData, updateMarker}) {
  const minutes = trackData.fullData['datetime'].map(x=>{return(x-trackData.fullData['datetime'][0])/60})
  function get_index(datetime) {
      return minutes.indexOf(datetime);
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

    if (!trackData) {
    return null
  }

  console.log(trackData)
  const distance_overtaker = transpose( [ minutes,trackData.fullData['distance_overtaker']])
  const distance_stationary = transpose( [ minutes,trackData.fullData['distance_stationary']])
  const speed = transpose( [ minutes,trackData.fullData['speed'].map(x=>{return x*3.6})])

  return (

    <Chart
      style={{height: 600}}

      onEvents={{
    'mouseMove': mouseMove,
    }}
      option={ {


  tooltip: {show:true},
  grid:[
          {left:'7%', top:'7%',right:'7%',bottom:'70%' },
          {left:'7%', top:'37%',right:'7%',bottom:'37%' },
          {left:'7%', top:'70%',right:'7%',bottom:'7%' }

          ],
      xAxis: [{gridIndex:0, scale:false, name: "minutes"},
         {gridIndex:1, scale:false, name: "minutes"},
         {gridIndex:2, scale:false, name: "minutes"}],
  yAxis: [{gridIndex:0, scale:false, name: "meters right"},
   {gridIndex:1, scale:false, name: "meters left"},
   {gridIndex:2, scale:false, name: "km/h"}],
  series: [
    { xAxisIndex: 0,
        yAxisIndex:0,
      symbolSize: 4,
      data: distance_overtaker,
      type: 'scatter'
    },
    {
        xAxisIndex: 1,
        yAxisIndex: 1,
      symbolSize: 4,
      data: distance_stationary,
      type: 'scatter'
    },
    {
        xAxisIndex: 2,
        yAxisIndex: 2,
      symbolSize: 4,
      data: speed,
      type: 'scatter'
    }
  ]
}
}
    >
    </Chart>
  )
}
