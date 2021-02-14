export type UserProfile = {
  username: string,
  image: string,
  bio?: string|null,
}

export type Track = {
  slug: string,
  author: UserProfile,
  title: string,
  description?: string,
  createdAt: string,
  visible?: boolean
}


export type TrackData = {
    slug: string,
    numEvents?: number|null,
    recordedAt?: String|null,
    recordedUntil?: String|null,
    trackLength?: number|null,
    points: TrackPoint[]
}

export type TrackPoint = {
  date: string|null,
  time: string|null,
  latitude: number|null,
  longitude: number|null,
  course: number|null,
  speed: number|null,
  d1: number|null,
  d2: number|null,
  flag: number|null,
  private: number|null,
}

export type TrackComment = {
  id: string,
  body: string,
  createdAt: string,
  author: UserProfile
}

