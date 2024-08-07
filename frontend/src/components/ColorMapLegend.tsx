import React, {useMemo} from 'react'

import styles from './ColorMapLegend.module.less'

type ColorMap = [number, string][]

function* pairs(arr) {
  for (let i = 1; i < arr.length; i++) {
    yield [arr[i - 1], arr[i]]
  }
}
function* zip(...arrs) {
  const l = Math.min(...arrs.map((a) => a.length))
  for (let i = 0; i < l; i++) {
    yield arrs.map((a) => a[i])
  }
}

export function DiscreteColorMapLegend({
  map,
  renderValue,
  min: min_,
  max: max_,
}: {
  map: ColorMap
  renderValue?: (x: value) => React.ReactNode
  min?: number
  max?: number
}) {
  const colors: string[] = map.filter((x, i) => i % 2 == 0) as any
  const stops: number[] = map.filter((x, i) => i % 2 == 1) as any

  let min = stops[0]
  let max = stops[stops.length - 1]
  const buffer = (max - min) / (stops.length - 1) / 2
  min -= buffer
  max += buffer

  if (min_ != null) min = min_
  if (max_ != null) max = max_

  const normalizeValue = (v) => (v - min) / (max - min)
  const stopPairs = Array.from(pairs([min, ...stops, max]))

  const gradientId = useMemo(() => `gradient${Math.floor(Math.random() * 1000000)}`, [])
  const gradientUrl = `url(#${gradientId})`

  const parts = Array.from(zip(stopPairs, colors))

  return (
    <div className={styles.colorMapLegend}>
      <svg width="100%" height="20" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            {parts.map(([[left, right], color]) => (
              <React.Fragment key={left}>
                <stop offset={normalizeValue(left) * 100 + '%'} stopColor={color} />
                <stop offset={normalizeValue(right) * 100 + '%'} stopColor={color} />
              </React.Fragment>
            ))}
          </linearGradient>
        </defs>

        <rect id="rect1" x="0" y="0" width="100%" height="100%" fill={gradientUrl} />
      </svg>

      {stops.map((value) => (
        <span className={styles.tick} key={value} style={{left: normalizeValue(value) * 100 + '%'}}>
          {renderValue?.(value) ?? value.toFixed(2)}
        </span>
      ))}
    </div>
  )
}

export default function ColorMapLegend({
  map,
  logTickMax,
  ticks: ticks_,
  unit = '',
}: {
  map: string[]
  ticks?: [number, number][]
  logTickMax?: number
  unit?: string
}) {
  const gradientId = useMemo(() => `gradient${Math.floor(Math.random() * 1000000)}`, [])
  const gradientUrl = `url(#${gradientId})`

  const ticks = ticks_ ?? []
  if (logTickMax) {
    const logMax = Math.log10(logTickMax)
    for (let i = 0; i <= logMax; i++) {
      ticks.push([i / logMax, Math.pow(10, i)])
    }
  }

  return (
    <div className={styles.colorMapLegend}>
      <svg width="100%" height="20" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            {map.map((color, index) => (
              <stop key={index} offset={(index / (map.length - 1)) * 100 + '%'} stopColor={color} />
            ))}
          </linearGradient>
        </defs>

        <rect id="rect1" x="0" y="0" width="100%" height="100%" fill={gradientUrl} />
      </svg>

      {ticks.map(([pos, val]) => (
        <span key={pos} className={styles.tick} style={{left: `${pos * 100}%`}}>
          {val}
          {unit}
        </span>
      ))}
    </div>
  )
}
