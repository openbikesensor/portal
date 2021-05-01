import React from 'react'
import {useObservable} from 'rxjs-hooks'
import {of} from 'rxjs'
import {switchMap} from 'rxjs/operators'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import {Stroke, Style} from 'ol/style'

import Map from './Map'

import {paletteUrban, paletteRural, palettePercentage, palettePercentageInverted} from 'palettes'

// var criterion = "d_mean";
// var criterion = "p_above";
var criterion = 'p_below'

// var hist_xa = 0.0
// var hist_xb = 2.55
// var hist_dx = 0.25
// var hist_n = Math.ceil((hist_xb - hist_xa) / hist_dx)

// function histogramLabels() {
//   var labels = Array(hist_n)
//   for (var i = 0; i < hist_n; i++) {
//     var xa = hist_xa + hist_dx * i
//     var xb = xa + hist_dx
//     var xc = xa + 0.5 * hist_dx
//     labels[i] = (xa * 100).toFixed(0) + '-' + (xb * 100).toFixed(0)
//   }
//
//   return labels
// }
//
// function histogramColors(palette) {
//   var colors = Array(hist_n)
//   for (var i = 0; i < hist_n; i++) {
//     var xc = hist_xa + hist_dx * i
//     colors[i] = palette.rgb_hex(xc)
//   }
//
//   return colors
// }
//
// function histogram(samples) {
//   var binCounts = new Array(hist_n).fill(0)
//
//   for (var i = 0; i < samples.length; i++) {
//     var v = samples[i]
//     var j = Math.floor((v - hist_xa) / hist_dx)
//     if (j >= 0 && j < hist_n) {
//       binCounts[j]++
//     }
//   }
//
//   return binCounts
// }
//
// function annotation_verbose(feature) {
//   var s = ''
//
//   s += 'name: ' + feature.get('name') + '\n'
//   s += 'way_id: ' + feature.get('way_id') + '\n'
//   s += 'direction: ' + feature.get('direction') + '\n'
//   s += 'zone: ' + feature.get('zone') + '\n'
//   s += 'valid: ' + feature.get('valid') + '\n'
//
//   d = feature.get('distance_overtaker_limit')
//   s += 'distance_overtaker_limit: ' + (d == null ? 'n/a' : d.toFixed(2)) + ' m \n'
//
//   s += '<hr></hr>statistics\n'
//
//   d = feature.get('distance_overtaker_mean')
//   s += 'distance_overtaker_mean: ' + (d == null ? 'n/a' : d.toFixed(2)) + ' m \n'
//
//   d = feature.get('distance_overtaker_median')
//   s += 'distance_overtaker_median: ' + (d == null ? 'n/a' : d.toFixed(2)) + ' m \n'
//
//   d = feature.get('distance_overtaker_minimum')
//   s += 'distance_overtaker_minimum: ' + (d == null ? 'n/a' : d.toFixed(2)) + ' m \n'
//
//   d = feature.get('distance_overtaker_n')
//   s += 'distance_overtaker_n: ' + (d == null ? 'n/a' : d.toFixed(0)) + '\n'
//
//   d = feature.get('distance_overtaker_n_above_limit')
//   s += 'distance_overtaker_n_above_limit: ' + (d == null ? 'n/a' : d.toFixed(0)) + '\n'
//
//   d = feature.get('distance_overtaker_n_below_limit')
//   s += 'distance_overtaker_n_below_limit: ' + (d == null ? 'n/a' : d.toFixed(0)) + '\n'
//
//   var n_below = feature.get('distance_overtaker_n_below_limit')
//   var n = feature.get('distance_overtaker_n')
//   var p = (n_below / n) * 100.0
//   s += 'overtakers below limit: ' + (p == null ? 'n/a' : p.toFixed(1)) + ' %\n'
//
//   return s
// }
//
// function annotation(feature) {
//   var s = '<table>'
//
//   s +=
//     '<tr><td>Stra&szlig;enname:</td><td><a href="https://www.openstreetmap.org/way/' +
//     feature.get('way_id') +
//     '" target="_blank">' +
//     feature.get('name') +
//     '</a></td></tr>'
//   d = feature.get('distance_overtaker_limit')
//   s += '<tr><td>Mindest&uuml;berholabstand:</td><td>' + (d == null ? 'n/a' : d.toFixed(2)) + ' m </td>'
//
//   d = feature.get('distance_overtaker_n')
//   s += '<tr><td>Anzahl Messungen:</td><td>' + (d == null ? 'n/a' : d.toFixed(0)) + '</td></tr>'
//
//   var n_below = feature.get('distance_overtaker_n_below_limit')
//   var n = feature.get('distance_overtaker_n')
//   var p = (n_below / n) * 100.0
//   s +=
//     '<tr><td>Unterschreitung Mindestabstand:</td><td>' +
//     (p == null ? 'n/a' : p.toFixed(1)) +
//     '% der &Uuml;berholenden</td></tr>'
//
//   d = feature.get('distance_overtaker_mean')
//   s += '<tr><td>Durchschnitt &Uuml;berholabstand:</td><td>' + (d == null ? 'n/a' : d.toFixed(2)) + ' m </td></tr>'
//
//   d = feature.get('distance_overtaker_median')
//   s += '<tr><td>Median &Uuml;berholabstand:</td><td>' + (d == null ? 'n/a' : d.toFixed(2)) + ' m </td></tr>'
//
//   d = feature.get('distance_overtaker_minimum')
//   s += '<tr><td>Minimum &Uuml;berholabstand:</td><td>' + (d == null ? 'n/a' : d.toFixed(2)) + ' m </td></tr>'
//
//   s += '</table>'
//
//   return s
// }

function styleFunction(feature, resolution, active = false) {
  const {
    distance_overtaker_n: n,
    distance_overtaker_n_above_limit: n_above_limit,
    distance_overtaker_n_below_limit: n_below_limit,
    distance_overtaker_mean: mean,
    distance_overtaker_median: median,
    distance_overtaker_minimum: minimum,
    zone,
    valid,
  } = feature.getProperties()

  let palette
  if (zone === 'urban') {
    palette = paletteUrban
  } else if (zone === 'rural') {
    palette = paletteRural
  } else {
    palette = paletteUrban
  }

  var color = [0, 0, 0, 255]

  if (valid) {
    switch (criterion) {
      case 'd_mean':
        color = palette.rgba_css(mean)
        break
      case 'd_median':
        color = palette.rgba_css(median)
        break
      case 'd_min':
        color = palette.rgba_css(minimum)
        break
      case 'p_above':
        color = palettePercentage.rgba_css(n > 0 ? (n_above_limit / n * 100) : undefined)
        break
      case 'p_below':
        color = palettePercentageInverted.rgba_css(n > 0 ? (n_below_limit / n * 100) : undefined)
        break
    }
  } else {
    color = [128, 128, 128, 255]
  }

  // var width = 2 + 1*Math.log10(n);
  var width = active ? 6 : 3
  // width =Math.max(2.0, width*1/resolution);

  var style = new Style({
    stroke: new Stroke({
      color: color,
      width: width,
    }),
  })
  return style
}

// var map = new ol.Map({
//   target: 'map',
//   layers: [
//     new ol.layer.Tile({
//       source: new ol.source.OSM({
//         url: 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
//         crossOrigin: null,
//         // url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
//       }),
//     }),
//   ],
//   view: new ol.View({
//     center: ol.proj.fromLonLat([9.1798, 48.7759]),
//     zoom: 13,
//   }),
// })

export default function RoadsLayer() {
  const dataSource = React.useMemo(
    () =>
      new VectorSource({
        format: new GeoJSON(),
        url: 'https://dev.openbikesensor.org/public/json/roads.json',
      }),
    []
  )

  return <Map.VectorLayer source={dataSource} style={styleFunction} zIndex={1000} />
}

// var histogramColorsRural = histogramColors(paletteRural).reverse()
// var histogramColorsUrban = histogramColors(paletteUrban).reverse()
//
// var chartOptions = {
//   series: [
//     {
//       name: 'Überholende',
//       data: Array(hist_n).fill(0),
//     },
//   ],
//   chart: {
//     type: 'bar',
//     height: 350,
//     animations: {
//       animateGradually: {
//         enabled: false,
//       },
//     },
//   },
//   plotOptions: {
//     bar: {
//       horizontal: false,
//       columnWidth: '95%',
//       endingShape: 'flat',
//       distributed: true,
//     },
//   },
//   dataLabels: {
//     enabled: true,
//   },
//   stroke: {
//     show: false,
//   },
//   xaxis: {
//     title: {
//       text: 'Überholabstand in Zentimeter',
//     },
//     categories: histogramLabels().reverse(),
//   },
//   yaxis: {
//     title: {
//       text: 'Anzahl Überholende',
//     },
//     labels: {
//       show: false,
//     },
//   },
//   fill: {
//     opacity: 1,
//   },
//   legend: {
//     show: false,
//   },
//   tooltip: {
//     y: {
//       formatter: function (val) {
//         return val
//       },
//     },
//   },
// }

// var chart = new ApexCharts(document.querySelector('#chart'), chartOptions)
// chart.render()

// var noFeatureActive = true

// map.on('singleclick', function (evt) {
//   var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
//     return feature
//   })
//
//   var resolution = map.getView().getResolution()
//
//   if (!noFeatureActive) {
//     vectorLayer
//       .getSource()
//       .getFeatures()
//       .forEach((f) => {
//         f.setStyle(styleFunction(f, resolution, false))
//       })
//     noFeatureActive = true
//   }
//
//   if (feature && dataSource.hasFeature(feature)) {
//     console.log(annotation_verbose(feature))
//     caption.innerHTML = annotation(feature)
//     caption.style.alignItems = 'flex-start'
//
//     var zone = feature.get('zone')
//     var colors = undefined
//     switch (zone) {
//       case 'urban':
//         colors = histogramColorsUrban
//         break
//       case 'rural':
//         colors = histogramColorsRural
//         break
//       default:
//         colors = histogramColorsUrban
//     }
//
//     chart.updateOptions({
//       colors: colors,
//     })
//
//     var hist = histogram(feature.get('distance_overtaker_measurements')).reverse()
//
//     chart.updateSeries([
//       {
//         name: 'Überholende',
//         data: hist,
//       },
//     ])
//
//     feature.setStyle(styleFunction(feature, resolution, true))
//     noFeatureActive = false
//   }
// })

//   function writeLegend(palette, target, ticks, postfix) {
//     const div = document.getElementById(target)
//     const canvas = document.createElement('canvas')
//     const context = canvas.getContext('2d')
//
//     const barWidth = palette.n
//     const barLeft = 25
//     const barHeight = 25
//
//     canvas.width = 300
//     canvas.height = 50
//
//     const imgData = context.getImageData(0, 0, barWidth, barHeight)
//     const data = imgData.data
//
//     let k = 0
//     for (let y = 0; y < barHeight; y++) {
//       for (let x = 0; x < barWidth; x++) {
//         for (let c = 0; c < 4; c++) {
//           data[k] = palette.rgba_sampled[x][c]
//           k += 1
//         }
//       }
//     }
//     context.putImageData(imgData, barLeft, 0)
//
//     context.font = '12px Arial'
//     context.textAlign = 'center'
//     context.textBaseline = 'top'
//     for (let i = 0; i < ticks.length; i++) {
//       const v = ticks[i]
//       const x = barLeft + ((v - palette.a) / (palette.b - palette.a)) * (palette.n - 1)
//       const y = 25
//       context.fillText(v.toFixed(2) + postfix, x, y)
//     }
//
//     const image = new Image()
//     image.src = canvas.toDataURL()
//     image.height = canvas.height
//     image.width = canvas.width
//     div.appendChild(image)
//   }
//
// writeLegend(palettePercentageInverted, 'colorbar', [0, 100.0], '%')
