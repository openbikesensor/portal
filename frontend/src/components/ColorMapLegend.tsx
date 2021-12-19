type ColorMap = [number, string][]

import styles from './ColorMapLegend.module.less'

export default function ColorMapLegend({map}: {map: ColorMap}) {
  const min = map[0][0]
  const max = map[map.length - 1][0]
  const normalizeValue = (v) => (v - min) / (max - min)
  if( typeof ColorMapLegend.counter == 'undefined' ) {
     ColorMapLegend.counter = 0;
  }
  ColorMapLegend.counter++;
  ColorMapLegend.id="gradient"+ColorMapLegend.counter;
  ColorMapLegend.url="url(#"+ColorMapLegend.id+")";
  return (
    <div className={styles.colorMapLegend}>
      <svg width="100%" height="20" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={ColorMapLegend.id} x1="0" x2="1" y1="0" y2="0">
            {map.map(([value, color]) => (
              <stop key={value} offset={normalizeValue(value) * 100 + '%'} stopColor={color} />
            ))}
          </linearGradient>
        </defs>

        <rect id="rect1" x="0" y="0" width="100%" height="100%" fill={ColorMapLegend.url} />
      </svg>
      {map.map(([value]) => (
        <span className={styles.tick} key={value} style={{left: normalizeValue(value) * 100 + '%'}}>
          {value.toFixed(2)}
        </span>
      ))}
    </div>
  )
}
