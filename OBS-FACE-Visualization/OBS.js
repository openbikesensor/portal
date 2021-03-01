class Palette {
    constructor(p, colorInvalid){
       this.colorInvalid = colorInvalid;
       this.resamplePalette(p, 256);
   }

   rgba(v){
       if (v == undefined){
           return this.colorInvalid;
       } 
       var i = (v - this.a)/(this.b - this.a) * (this.n - 1);
       i = Math.round(i);
       i = Math.max(0, Math.min(this.n - 1, i));
       return this.rgba_sampled[i];
   }

   rgba_css(v){
    var color = this.rgba(v);
    return "rgba(" + [color[0],color[1],color[2],color[3]].join(',') +")";
}

rgb_css(v){
    var color = this.rgba(v);
    return "rgb(" + [color[0],color[1],color[2]].join(',') +")";
}

rgb_hex(v){
    var color = this.rgba(v);

    var s = "#" + this.hex2digits(color[0]) + this.hex2digits(color[1]) + this.hex2digits(color[2]);

    return s;
}

hex2digits(v) {
  var hex = v.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}


samplePalette(palette, d){
    var x = Object.keys(palette);

    for (var i=0; i<x.length; i++){
        x[i] = parseFloat(x[i]);
    }

    x = x.sort(function(a, b) {
        return a - b;
    });

    var n = x.length;
    var y;

    if (d <= x[0]){
        y = palette[x[0]];
    } else if (d >= x[n-1]) {
        y = palette[x[n-1]];
    } else {
        var ia = 0;
        var ib = n - 1;

        while (ib-ia > 1){
            var ic = Math.round(0.5*(ia + ib));
            if (d < x[ic]){
                ib = ic;
            } else {
                ia = ic;
            }
        }

        var xa = x[ia];
        var xb = x[ib];
        var w = (d - xa)/(xb - xa);
        y = Array(4);
        var ya = palette[xa];
        var yb = palette[xb];
        for (var i=0; i<4; i++){
            y[i] = Math.round(ya[i] * (1-w) + yb[i] * w);
        }
    }
    return y;
}

resamplePalette(palette, n){
    var x = Object.keys(palette);

    for (var i=0; i<x.length; i++){
        x[i] = parseFloat(x[i]);
    }

    var a = Math.min(...x);
    var b = Math.max(...x);

    var p = new Array(n);

    for (var i=0; i<n; i++){
        var xi = a + (parseFloat(i)/(n-1))*(b-a);
        p[i] = this.samplePalette(palette, xi);
    }

    this.a = a;
    this.b = b;
    this.rgba_sampled = p;
    this.n = n;
}

writeLegend(target, ticks, postfix){
    var div = document.getElementById(target);
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");

    var barWidth = this.n;
    var barLeft = 25;
    var barHeight = 25;

    canvas.width = 300;
    canvas.height = 50;

    var imgData = context.getImageData(0, 0, barWidth, barHeight);
    var data = imgData.data;

    var k = 0;
    for (var y=0; y<barHeight; y++){
        for (var x=0; x<barWidth; x++){
            for (var c=0; c<4; c++){
                data[k] = this.rgba_sampled[x][c];
                k += 1;
            }
        }
    }
    context.putImageData(imgData, barLeft, 0);

    context.font = "12px Arial";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (var i=0; i<ticks.length; i++){
        var v = ticks[i];
        var x = barLeft + (v - this.a)/(this.b - this.a)*(this.n - 1);
        var y = 25;
        context.fillText(v.toFixed(2) + postfix, x, y);
    }

    var image = new Image();
    image.src = canvas.toDataURL();
    image.height = canvas.height;
    image.width = canvas.width;
    div.appendChild(image);

}
}

paletteUrban = new Palette({
    0.0000: [ 64,   0,   0, 255],
    1.4999: [196,   0,   0, 255],
    1.5000: [196, 196,   0, 255],
    2.0000: [  0, 196,   0, 255],
    2.5500: [  0, 255,   0, 255]
}, [0, 0, 196, 255]);

paletteRural = new Palette({
    0.0000: [ 64,   0,   0, 255],
    1.9999: [196,   0,   0, 255],
    2.0000: [196, 196,   0, 255],
    2.5000: [  0, 196,   0, 255],
    2.5500: [  0, 255,   0, 255]
}, [0, 0, 196, 255]);

paletteRural_ryg = new Palette({
    0.0000: [196,   0,   0, 255],
    1.5000: [196,   0,   0, 255],
    1.5000: [196, 196,   0, 255],
    2.0000: [196, 196,   0, 255],
    2.0000: [0,   196,   0, 255],
}, [0, 0, 196, 255]);

paletteUrban_ryg = new Palette({
    0.0000: [196,   0,   0, 255],
    2.0000: [196,   0,   0, 255],
    2.0000: [196, 196,   0, 255],
    2.5000: [196, 196,   0, 255],
    2.5000: [0,   196,   0, 255],
}, [0, 0, 196, 255]);

colorUndefinedDistance = [0, 0, 0, 0];

palettePercentage = new Palette({
    0.0000: [ 64, 0,   0, 255],
    25.0000: [196,   0,   0, 255],
    90.0000: [196, 196,   0, 255],
    100.0000: [  0, 255,   0, 255],
}, [0, 0, 196, 255]);

palettePercentageInverted = new Palette({
    0.0000: [  0, 255,   0, 255],
    10.0000: [196, 196,   0, 255],
    75.0000: [196,   0,   0, 255],
    100.0000: [ 64, 0,   0, 255],
}, [0, 0, 196, 255]);

palettePercentageZweirat = new Palette({
    0.0000: [  0, 255,   0, 255],
    50.0000: [255, 255,   0, 255],
    100.0000: [ 255, 0,   0, 255],
}, [0, 0, 196, 255]);

