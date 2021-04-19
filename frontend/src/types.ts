import type {FeatureCollection, Point} from 'geojson'

export type UserProfile = {
  username: string
  image: string
  bio?: string | null
}

export type TrackData = FeatureCollection
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
