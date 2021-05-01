export class Palette {
  constructor(p, colorInvalid) {
    this.colorInvalid = colorInvalid
    this.resamplePalette(p, 256)
  }

  rgba(v) {
    if (v == null) {
      return this.colorInvalid
    }
    let i = ((v - this.a) / (this.b - this.a)) * (this.n - 1)
    i = Math.round(i)
    i = Math.max(0, Math.min(this.n - 1, i))
    return this.rgba_sampled[i]
  }

  rgba_css(v) {
    const color = this.rgba(v)
    return 'rgba(' + [color[0], color[1], color[2], color[3]].join(',') + ')'
  }

  rgb_css(v) {
    const color = this.rgba(v)
    return 'rgb(' + [color[0], color[1], color[2]].join(',') + ')'
  }

  rgb_hex(v) {
    const color = this.rgba(v)

    const s = '#' + this.hex2digits(color[0]) + this.hex2digits(color[1]) + this.hex2digits(color[2])

    return s
  }

  hex2digits(v) {
    const hex = v.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  samplePalette(palette, d) {
    let x = Object.keys(palette)

    for (let i = 0; i < x.length; i++) {
      x[i] = parseFloat(x[i])
    }

    x = x.sort(function (a, b) {
      return a - b
    })

    const n = x.length
    let y

    if (d <= x[0]) {
      y = palette[x[0]]
    } else if (d >= x[n - 1]) {
      y = palette[x[n - 1]]
    } else {
      let ia = 0
      let ib = n - 1

      while (ib - ia > 1) {
        const ic = Math.round(0.5 * (ia + ib))
        if (d < x[ic]) {
          ib = ic
        } else {
          ia = ic
        }
      }

      const xa = x[ia]
      const xb = x[ib]
      const w = (d - xa) / (xb - xa)
      y = Array(4)
      const ya = palette[xa]
      const yb = palette[xb]
      for (let i = 0; i < 4; i++) {
        y[i] = Math.round(ya[i] * (1 - w) + yb[i] * w)
      }
    }
    return y
  }

  resamplePalette(palette, n) {
    const x = Object.keys(palette)

    for (let i = 0; i < x.length; i++) {
      x[i] = parseFloat(x[i])
    }

    const a = Math.min(...x)
    const b = Math.max(...x)

    const p = new Array(n)

    for (let i = 0; i < n; i++) {
      const xi = a + (parseFloat(i) / (n - 1)) * (b - a)
      p[i] = this.samplePalette(palette, xi)
    }

    this.a = a
    this.b = b
    this.rgba_sampled = p
    this.n = n
  }
}

export const paletteUrban = new Palette(
  {
    0.0: [64, 0, 0, 255],
    1.4999: [196, 0, 0, 255],
    1.5: [196, 196, 0, 255],
    2.0: [0, 196, 0, 255],
    2.55: [0, 255, 0, 255],
  },
  [0, 0, 196, 255]
)

export const paletteRural = new Palette(
  {
    0.0: [64, 0, 0, 255],
    1.9999: [196, 0, 0, 255],
    2.0: [196, 196, 0, 255],
    2.5: [0, 196, 0, 255],
    2.55: [0, 255, 0, 255],
  },
  [0, 0, 196, 255]
)

export const paletteRural_ryg = new Palette(
  {
    0.0: [196, 0, 0, 255],
    1.5: [196, 196, 0, 255],
    2.0: [0, 196, 0, 255],
  },
  [0, 0, 196, 255]
)

export const paletteUrban_ryg = new Palette(
  {
    0.0: [196, 0, 0, 255],
    2.0: [196, 196, 0, 255],
    2.5: [0, 196, 0, 255],
  },
  [0, 0, 196, 255]
)

export const colorUndefinedDistance = [0, 0, 0, 0]

export const palettePercentage = new Palette(
  {
    0.0: [64, 0, 0, 255],
    25.0: [196, 0, 0, 255],
    90.0: [196, 196, 0, 255],
    100.0: [0, 255, 0, 255],
  },
  [0, 0, 196, 255]
)

export const palettePercentageInverted = new Palette(
  {
    0.0: [0, 255, 0, 255],
    10.0: [196, 196, 0, 255],
    75.0: [196, 0, 0, 255],
    100.0: [64, 0, 0, 255],
  },
  [0, 0, 196, 255]
)
