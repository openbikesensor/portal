import React from 'react'
import {Vector as VectorSource} from 'ol/source'
import {Geometry, LineString, Point} from 'ol/geom'
import Feature from 'ol/Feature'
import {fromLonLat} from 'ol/proj'
import {Fill, Stroke, Style, Text, Circle} from 'ol/style'

import {Map} from 'components'
import type {TrackData, TrackPoint} from 'types'

const isValidTrackPoint = (point: TrackPoint): boolean => {
  const longitude = point.geometry?.coordinates?.[0]
  const latitude = point.geometry?.coordinates?.[1]

  return latitude != null && longitude != null && (latitude !== 0 || longitude !== 0)
}

const WARN_DISTANCE = 2
const MIN_DISTANCE = 1.5

const evaluateDistanceColor = function (distance) {
  if (distance < MIN_DISTANCE) {
    return 'red'
  } else if (distance < WARN_DISTANCE) {
    return 'orange'
  } else {
    return 'green'
  }
}

const evaluateDistanceForFillColor = function (distance) {
  const redFill = new Fill({color: 'rgba(255, 0, 0, 0.2)'})
  const orangeFill = new Fill({color: 'rgba(245,134,0,0.2)'})
  const greenFill = new Fill({color: 'rgba(50, 205, 50, 0.2)'})

  switch (evaluateDistanceColor(distance)) {
    case 'red':
      return redFill
    case 'orange':
      return orangeFill
    case 'green':
      return greenFill
  }
}

const evaluateDistanceForStrokeColor = function (distance) {
  const redStroke = new Stroke({color: 'rgb(255, 0, 0)'})
  const orangeStroke = new Stroke({color: 'rgb(245,134,0)'})
  const greenStroke = new Stroke({color: 'rgb(50, 205, 50)'})

  switch (evaluateDistanceColor(distance)) {
    case 'red':
      return redStroke
    case 'orange':
      return orangeStroke
    case 'green':
      return greenStroke
  }
}

const createTextStyle = function (distance, resolution) {
  return new Text({
    textAlign: 'center',
    textBaseline: 'middle',
    font: 'normal 18px/1 Arial',
    text: resolution < 6 ? '' + Number(distance).toFixed(2) : '',
    fill: new Fill({color: evaluateDistanceColor(distance)}),
    stroke: new Stroke({color: 'white', width: 2}),
    offsetX: 0,
    offsetY: 0,
  })
}

function pointStyleFunction(feature, resolution) {
  let distance = feature.get('distance')
  let radius = 200 / resolution

  return new Style({
    image: new Circle({
      radius: radius < 20 ? radius : 20,
      fill: evaluateDistanceForFillColor(distance),
      stroke: evaluateDistanceForStrokeColor(distance),
    }),
    text: createTextStyle(distance, resolution),
  })
}

function PointLayer({features, title, visible}) {
  return <Map.VectorLayer {...{title, visible}} style={pointStyleFunction} source={new VectorSource({features})} />
}

export default function TrackMap({trackData, show, ...props}: {trackData: TrackData}) {
  const {
    trackVectorSource,
    trackPointsD1,
    trackPointsD2,
    trackPointsUntaggedD1,
    trackPointsUntaggedD2,
    viewExtent,
  } = React.useMemo(() => {
    const trackPointsD1: Feature<Point>[] = []
    const trackPointsD2: Feature<Point>[] = []
    const trackPointsUntaggedD1: Feature<Point>[] = []
    const trackPointsUntaggedD2: Feature<Point>[] = []
    const points: Coordinate[] = []
    const filteredPoints: TrackPoint[] = trackData?.features.filter(isValidTrackPoint) ?? []

    for (const feature of filteredPoints) {
      const {
        geometry: {
          coordinates: [latitude, longitude],
        },
        properties: {confirmed: flag, distanceOvertaker: d1, distanceStationary: d2},
      } = feature

      const p = fromLonLat([longitude, latitude])
      points.push(p)

      const geometry = new Point(p)

      if (flag && d1) {
        trackPointsD1.push(new Feature({distance: d1, geometry}))
      }

      if (flag && d2) {
        trackPointsD2.push(new Feature({distance: d2, geometry}))
      }

      if (!flag && d1) {
        trackPointsUntaggedD1.push(new Feature({distance: d1, geometry}))
      }

      if (!flag && d2) {
        trackPointsUntaggedD2.push(new Feature({distance: d2, geometry}))
      }
    }

    //Simplify to 1 point per 2 meter
    const trackVectorSource = new VectorSource({
      features: [new Feature(new LineString(points).simplify(2))],
    })

    const viewExtent = points.length ? trackVectorSource.getExtent() : null
    return {trackVectorSource, trackPointsD1, trackPointsD2, trackPointsUntaggedD1, trackPointsUntaggedD2, viewExtent}
  }, [trackData?.features])

  const trackLayerStyle = React.useMemo(
    () =>
      new Style({
        stroke: new Stroke({
          width: 3,
          color: 'rgb(30,144,255)',
        }),
      }),
    []
  )

  return (
    <Map {...props}>
      <Map.TileLayer />
      <Map.VectorLayer
        visible
        updateWhileAnimating={false}
        updateWhileInteracting={false}
        source={trackVectorSource}
        style={trackLayerStyle}
      />

      <Map.GroupLayer title="Tagged Points" visible>
        <PointLayer features={trackPointsD1} title="Left" visible={show.left} />
        <PointLayer features={trackPointsD2} title="Right" visible={show.right} />
      </Map.GroupLayer>

      <Map.GroupLayer title="Untagged Points" fold="close" visible>
        <PointLayer features={trackPointsUntaggedD1} title="Left Untagged" visible={show.leftUnconfirmed} />
        <PointLayer features={trackPointsUntaggedD2} title="Right Untagged" visible={show.rightUnconfirmed} />
      </Map.GroupLayer>

      <Map.View maxZoom={22} zoom={15} center={fromLonLat([9.1797, 48.7784])} />
      <Map.FitView extent={viewExtent} />
    </Map>
  )
}
