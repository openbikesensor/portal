import _ from 'lodash'

import bright from './bright.json'

function getRoadsStyle(sourceUrl = "http://localhost:3002/data/v3.json") {
  return {
    "version": 8,
    "name": "OBS Roads",
    "sources": {
      "obs": {"type": "vector", "url": sourceUrl}
    },
    "layers": [
      {
        "id": "obs",
        "type": "line",
        "source": "obs",
        "source-layer": "obs_roads",
        "layout": {"line-cap": "round", "line-join": "round"},
        "paint": {
          "line-width": {"stops": [[14, 2], [17, 8]]},
          "line-color": [
            "interpolate-hcl",
            ["linear"],
            ["get", "distance_overtaker_mean"],
            1,
            "rgba(255, 0, 0, 1)",
            1.3,
            "rgba(255, 200, 0, 1)",
            1.5,
            "rgba(67, 200, 0, 1)",
            1.7,
            "rgba(67, 150, 0, 1)"
          ],
          "line-opacity": 1,
          "line-offset": {"stops": [[14, 1], [17, 7]]}
        }
      }
    ],
    "id": "obs-roads"
  }
}

function mergeStyles(baseStyle, ...extensions) {
  const style = _.cloneDeep(baseStyle)
  for (const extension of extensions) {
    for (const key of Object.keys(extension)) {
      if (['sources', 'layers', 'id', 'name', 'version'].includes(key)) {
        continue
      }

      throw new Error(`cannot use style ${extension.id ?? extension.name} as extension style, it defines ${key}`)
    }
    style.sources = {...style.sources, ...extension.sources}
    style.layers = [...style.layers, ...extension.layers]
  }

  return style
}

export const basemap = bright
export const obsRoads = (sourceUrl) => mergeStyles(basemap, getRoadsStyle(sourceUrl))
