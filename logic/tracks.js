const csvParse = require('csv-parse/lib/sync');

function _parseFloat(token) {
  let f = parseFloat(token);
  if (isNaN(f)) {
    f = parseFloat(token.substring(0, 10));
  }
  if (isNaN(f)) {
    f = 0.0;
  }
  return f;
}

function addPointsToTrack(trackInfo, body, format = null) {
  const detectedFormat = format != null ? format : detectFormat(body);

  let parser;
  switch (detectedFormat) {
    case 'invalid':
      throw new Error('track format cannot be detected');

    case 1:
      parser = parseObsver1;
      break;

    case 2:
      parser = parseObsver2;
      break;
  }

  const points = trackInfo.trackData.points;
  for (const newPoint of parser(body)) {
    points.push(newPoint);
  }
}

function detectFormat(body) {
  if (!body.length) {
    return 'invalid';
  }

  const firstLinebreakIndex = body.indexOf('\n');

  if (firstLinebreakIndex === -1) {
    return 1;
  }

  const firstLine = body.substring(0, firstLinebreakIndex);

  const match = firstLine.match(/(^|&)OBSDataFormat=([\d]+)($|&)/);
  if (match) {
    return Number(match[2]);
  }

  return 'invalid';
}

function* parseObsver1(body) {
  let num = 0;
  let start = 0;
  let end = 0;

  let currentPoint;

  while (end < body.length) {
    start = end;
    while (body[end] !== ';' && body[end] !== '$' && end < body.length) {
      end++;
    }
    if (body[end] === '$') {
      if (currentPoint) {
        yield currentPoint;
      }
      // $ is replacing \n as newlines are not allowed in json strings
      num = 0;
    }
    if (end < body.length) {
      const token = body.substr(start, end - start);
      end++;

      if (token.length > 0) {
        if (num === 0 && token === 'Date') {
          // we have a header line, ignore it for now, TODO parse it
          if (end < body.length) {
            while (body[end] !== ';' && body[end] !== '$' && end < body.length) {
              end++;
            }
            start = end;
            num = 100;
          }
        }

        switch (num) {
          case 0:
            currentPoint = {
              date: token,
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
  if (currentPoint) {
    yield currentPoint;
  }
}

function* parseObsver2(body) {
  for (const record of csvParse(body, {
    from_line: 2,
    trim: true,
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    encoding: 'utf8',
    relax_column_count: true,
    cast(value, context) {
      if (value === '') {
        return null;
      }

      let type;
      switch (context.column) {
        case 'Millis':
        case 'Left':
        case 'Right':
        case 'Confirmed':
        case 'Invalid':
        case 'InsidePrivacyArea':
        case 'Measurements':
        case 'Satellites':
          type = 'int';
          break;

        case 'Date':
        case 'Time':
        case 'Comment':
        case 'Marked':
          type = 'string';
          break;

        case 'Latitude':
        case 'Longitude':
        case 'Altitude':
        case 'Course':
        case 'Speed':
        case 'HDOP':
        case 'BatteryLevel':
        case 'Factor':
          type = 'float';
          break;

        default:
          type = /^(Tms|Lus|Rus)/.test(context.column) ? 'int' : 'string';
      }

      switch (type) {
        case 'int':
          return parseInt(value);

        case 'float':
          return parseFloat(value);

        case 'string':
          return value;
      }
    },
  })) {
    // We convert the new format back to the old format for storage here, until
    // we upgrade the storage format as well to include all data. But we'll
    // have to upgrade the obsApp first.
    yield {
      date: record.Date,
      time: record.Time,
      latitude: record.Latitude,
      longitude: record.Longitude,
      course: record.Course,
      speed: record.Speed,
      d1: record.Left,
      d2: record.Right,
      flag: Boolean(record.Confirmed),
      private: Boolean(record.InsidePrivacyArea),
    };
  }
}

module.exports = { addPointsToTrack, detectFormat, parseObsver1, parseObsver2 };
