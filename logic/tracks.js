function _parseFloat(token) {
  var f = parseFloat(token);
  if (isNaN(f)) {
    f = parseFloat(token.substring(0, 10));
  }
  if (isNaN(f)) {
    f = 0.0;
  }
  return f;
}

module.exports.addPointsToTrack = function addPointsToTrack(track, body) {
  var num = 0;
  var start = 0;
  var end = 0;

  // reference to the array we will mutate
  var points = track.trackData.points;
  var currentPoint;

  while (end < body.length) {
    start = end;
    while (body[end] != ';' && body[end] != '$' && end < body.length) {
      end++;
    }
    if (body[end] == '$') {
      // $ is replacing \n as newlines are not allowed in json strings
      num = 0;
    }
    if (end < body.length) {
      var token = body.substr(start, end - start);
      end++;

      if (token.length > 0) {
        if (num == 0 && token == 'Date') {
          // we have a header line, ignore it for now, TODO parse it
          if (end < body.length) {
            while (body[end] != ';' && body[end] != '$' && end < body.length) {
              end++;
            }
            start = end;
            num = 100;
          }
        }

        switch (num) {
          case 0:
            currentPoint = {
              date: 'dummy',
              time: '',
              latitude: '',
              longitude: '',
              course: '',
              speed: '',
              d1: '',
              d2: '',
              flag: '',
              private: '',
            };

            points.push(currentPoint);

            currentPoint.date = token;
            break;

          case 1:
            currentPoint.time = token;
            break;

          case 2:
            currentPoint.latitude = _parseFloat(token);
            break;

          case 3:
            currentPoint.longitude = _parseFloat(token);
            break;

          case 4:
            currentPoint.course = _parseFloat(token);
            break;

          case 5:
            currentPoint.speed = _parseFloat(token);
            break;

          case 6:
            currentPoint.d1 = token;
            break;

          case 7:
            currentPoint.d2 = token;
            break;

          case 8:
            currentPoint.flag = token;
            break;

          case 9:
            currentPoint.private = token;
            break;
        }

        num++;
      }
    }
  }
};
