import React from 'react'
import {Vector as VectorSource} from 'ol/source'
import {LineString, Point} from 'ol/geom'
import Feature from 'ol/Feature'
import {fromLonLat} from 'ol/proj'
import {Fill, Stroke, Style, Text, Circle} from 'ol/style'

import {Map} from 'components'
import type {TrackData, TrackPoint} from 'types'
import config from 'config.json'

const isValidTrackPoint = (point: TrackPoint): boolean => {
  const longitude = point.geometry?.coordinates?.[0]
  const latitude = point.geometry?.coordinates?.[1]

  return latitude != null && longitude != null && (latitude !== 0 || longitude !== 0)
}

const WARN_DISTANCE = 2
const MIN_DISTANCE = 1.5

const evaluateDistanceColor = function (distance: number) {
  if (distance < MIN_DISTANCE) {
    return 'red'
  } else if (distance < WARN_DISTANCE) {
    return 'orange'
  } else {
    return 'green'
  }
}

const evaluateDistanceForFillColor = function (distance: number) {
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

const evaluateDistanceForStrokeColor = function (distance: number) {
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

const createTextStyle = function (distance: number, resolution: number) {
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


const trackStroke = new Stroke({width: 4, color: 'rgb(30,144,255)'})
const trackLayerStyle = new Style({stroke: trackStroke})

function trackLayerStyleWithArrows(feature, resolution) {
  const geometry = feature.getGeometry()

  let styles = [trackLayerStyle]

  // Numbers are in pixels
  const arrowLength = 10 * resolution
  const arrowSpacing = 200 * resolution

  const a = arrowLength / Math.sqrt(2)
  let spaceSinceLast = 0

  geometry.forEachSegment(function (start, end) {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const d = Math.sqrt(dx * dx + dy * dy)
    const rotation = Math.atan2(dy, dx)
    spaceSinceLast += d

    while (spaceSinceLast > arrowSpacing) {
      spaceSinceLast -= arrowSpacing

      let offsetAlongLine = (d - spaceSinceLast) / d
      let pos = [start[0] + dx * offsetAlongLine, start[1] + dy * offsetAlongLine]

      const lineStr1 = new LineString([pos, [pos[0] - a, pos[1] + a]])
      lineStr1.rotate(rotation, pos)
      const lineStr2 = new LineString([pos, [pos[0] - a, pos[1] - a]])
      lineStr2.rotate(rotation, pos)

      styles.push(
        new Style({
          geometry: lineStr1,
          stroke: trackStroke,
        })
      )
      styles.push(
        new Style({
          geometry: lineStr2,
          stroke: trackStroke,
        })
      )
    }
  })

  return styles
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
    const filteredPoints: TrackPoint[] = trackData?.allMeasurements?.features.filter(isValidTrackPoint) ?? []

    for (const feature of filteredPoints) {
      const {
        geometry: {
          coordinates: [latitude, longitude],
        },
        properties: {confirmed: flag, distanceOvertaker: d1, distanceStationary: d2},
      } = feature

      const p = fromLonLat([longitude, latitude])

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

    const points: Coordinate[] =
      trackData?.track.geometry.coordinates.map(([latitude, longitude]) => {
        return fromLonLat([longitude, latitude])
      }) ?? []

    //Simplify to 1 point per 2 meter
    const trackVectorSource = new VectorSource({
      features: [new Feature(new LineString(points).simplify(2))],
    })

    const viewExtent = points.length ? trackVectorSource.getExtent() : null
    return {trackVectorSource, trackPointsD1, trackPointsD2, trackPointsUntaggedD1, trackPointsUntaggedD2, viewExtent}
  }, [trackData?.allMeasurements?.features])

  return (
    <Map {...props}>
      <Map.BaseLayer />
      <Map.VectorLayer
        visible
        updateWhileAnimating={false}
        updateWhileInteracting={false}
        source={trackVectorSource}
        style={trackLayerStyleWithArrows}
      />

      <Map.GroupLayer title="Tagged Points" visible>
        <PointLayer features={trackPointsD1} title="Left" visible={show.left} />
        <PointLayer features={trackPointsD2} title="Right" visible={show.right} />
      </Map.GroupLayer>

      <Map.GroupLayer title="Untagged Points" fold="close" visible>
        <PointLayer features={trackPointsUntaggedD1} title="Left Untagged" visible={show.leftUnconfirmed} />
        <PointLayer features={trackPointsUntaggedD2} title="Right Untagged" visible={show.rightUnconfirmed} />
      </Map.GroupLayer>

      <Map.View />
      <Map.FitView extent={viewExtent} />
    </Map>
  )
}
