module.exports.addPointsToTrack = function addPointsToTrack(track, body)
{
  var num = 0;
  var start = 0;
  var end = 0;
 //console.log("len"+body.length);
  while (end < body.length) {
    start = end;
    while (body[end] != ";" && body[end] != "$" && end < body.length) {
      end++;
    }
    if(body[end] == "$") // $ is replacing \n as newlines are not allowed in json strings
    {
        num=0;
    }
    if(end < body.length)
    {
    var token = body.substr(start, end - start);
    end++;
    if(token.length>0)
    {
    //console.log(token);
    //console.log("num:"+num);
    //console.log("end:"+end);

    if((num == 0) && (token == "Date"))
    {
      // we have a header line, ignore it for now, TODO parse it
      if (end < body.length) {
        while (body[end] != ";" && body[end] != "$" && end < body.length) {
          end++;
        }
        start = end;
        num=100;
      }
    }
    if (num == 0) {
      track.trackData.points.push({ date: "dummy", time: "", latitude: "", longitude: "", course: "", speed: "", d1: "", d2: "", flag: "", private: ""});
      track.trackData.points[track.trackData.points.length - 1].date = token;
      num++;
    }
    else if (num == 1) {
      track.trackData.points[track.trackData.points.length - 1].time = token;
      num++;
    }
    else if (num == 2) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].latitude = f;
      num++;
    }
    else if (num == 3) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].longitude = f;
      num++;
    }
    else if (num == 4) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].course = f;
      num++;
    }
    else if (num == 5) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].speed = f;
      num++;
    }
    else if (num == 6) {
      track.trackData.points[track.trackData.points.length - 1].d1 = token;
      num++;
    }
    else if (num == 7) {
      track.trackData.points[track.trackData.points.length - 1].d2 = token;
      num++;
    }
    else if (num == 8) {
      track.trackData.points[track.trackData.points.length - 1].flag = token;
      num++;
    }
    else if (num == 9) {
      track.trackData.points[track.trackData.points.length - 1].private = token;
      num++;
    }
    }
    }
  }
}
