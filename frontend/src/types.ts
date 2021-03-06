import type {FeatureCollection, Feature, LineString, Point} from 'geojson'

export type UserProfile = {
  username: string
  image?: string | null
  bio?: string | null
}

export type TrackData = {
  track: Feature<LineString>,
  allMeasurements: FeatureCollection,
  confirmedMeasurements: FeatureCollection,
}

export type TrackStatistics = {
  recordedAt?: Date
  recordedUntil?: Date
  duration?: number
  length?: number
  segments?: number
  numEvents?: number
  numMeasurements?: number
  numValid?: number
}

export type Track = {
  slug: string
  author: UserProfile
  title: string
  description?: string
  createdAt: string
  public?: boolean
  statistics?: TrackStatistics
}

export type TrackPoint = {
  type: 'Feature',
  geometry: Point,
  properties: {
    distanceOvertaker: null | number,
    distanceStationary: null | number,
  },
}

export type TrackComment = {
  id: string
  body: string
  createdAt: string
  author: UserProfile
}
