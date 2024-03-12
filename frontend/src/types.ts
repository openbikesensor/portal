import type {FeatureCollection, Feature, LineString, Point} from 'geojson'

export interface UserProfile {
  username: string
  displayName: string
  image?: string | null
  bio?: string | null
}

export interface TrackData {
  track: Feature<LineString>
  events: FeatureCollection<Point>
}

export type ProcessingStatus = 'error' | 'complete' | 'created' | 'queued' | 'processing'

export interface Track {
  slug: string
  author: UserProfile
  title: string
  description?: string
  createdAt: string
  processingStatus?: ProcessingStatus
  public?: boolean
  recordedAt?: Date
  recordedUntil?: Date
  duration?: number
  length?: number
  segments?: number
  numEvents?: number
  numMeasurements?: number
  numValid?: number
  userDeviceId?: number
  processingLog?: string
}

export interface TrackPoint {
  type: 'Feature'
  geometry: Point
  properties: {
    distanceOvertaker: null | number
    distanceStationary: null | number
  }
}

export interface TrackComment {
  id: string
  body: string
  createdAt: string
  author: UserProfile
}

export interface Location {
  longitude: number
  latitude: number
}

export interface UserDevice {
  id: number
  identifier: string
  displayName?: string
}
