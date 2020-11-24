const csvParse = require('csv-parse/lib/sync');

function _parseFloat(token) {
  if (typeof token !== 'string') {
    return null;
  }

  token = token.trim();

  if (token === '') {
    return null;
  }

  if (/^nan$/i.test(token)) {
    return null;
  }

  let f = parseFloat(token);

  if (isNaN(f)) {
    f = parseFloat(token.substring(0, 10));
  }

  if (isNaN(f)) {
    f = 0.0;
  }

  return f;
}

function _parseInt(token) {
  const asFloat = parseFloat(token);
  if (asFloat !== null) {
    return Math.floor(asFloat);
  } else {
    return asFloat;
  }
}

function _parseString(token) {
  if (typeof token !== 'string') {
    return null;
  }
  // This time we do not trim -- because we assume that the quoting mechanism
  // from CSV might have kicked in and we actually want the spacing around the
  // token.

  if (token === '') {
    return null;
  }

  return token;
}

function replaceDollarNewlinesHack(body) {
  // see if we are using the hack with $ as newlines, replace them for the csv parser
  if (body.endsWith('$') || /insidePrivacyArea;\$/.test(body)) {
    return body.replace(/\$/g, '\n');
  }

  return body;
}

function* parseTrackPoints(body, format = null) {
  body = replaceDollarNewlinesHack(body);

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

  yield* parser(body);
}

function detectFormat(body) {
  body = replaceDollarNewlinesHack(body);

  if (!body.length) {
    return 'invalid';
  }

  const firstLinebreakIndex = body.indexOf('\n');

  if (firstLinebreakIndex === -1) {
    // We need at least one linebreak in the whole file, to separate header and
    // data. If the file contains no header, it is in valid.
    return 'invalid';
  }

  const firstLine = body.substring(0, firstLinebreakIndex);

  const match = firstLine.match(/(^|&)OBSDataFormat=([\d]+)($|&)/);
  if (match) {
    return Number(match[2]);
  }

  // If we have no metadata line, but start immediately with a header, AND it contains
  // `;Rus`, it is a version 2
  if (/^Date;Time.*;Rus/.test(firstLine)) {
    return 2;
  }

  // If we have no metadata line, but start immediately with a header, it is
  // format version 1.
  if (/^Date;Time/.test(firstLine)) {
    return 1;
  }

  // If we immediately start with data (a date, formatted as DD.MM.YYYY), then
  // we have an old OBS not sending the header. It must therefore be old
  // format, too.
  if (/^[0-9]{2}\.[0-9]{2}\.[0-9]{4};/.test(firstLine)) {
    return 1;
  }

  return 'invalid';
}

function* parseObsver1(body) {
  for (const record of csvParse(body, {
    delimiter: ';',
    encoding: 'utf8',
    // We specify  different column names here, as the order of columns was
    // always the same, but their naming was different. By enforicing these
    // column names we don't have to translate between them. Then we just
    // ignore the first line (or any line that starts with "Date;").
    // Original header usually is:
    // Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed;insidePrivacyArea
    columns: ['date', 'time', 'latitude', 'longitude', 'course', 'speed', 'd1', 'd2', 'flag', 'private'],
    relax_column_count: true,
    cast(value, { column }) {
      if (['latitude', 'longitude', 'course', 'speed'].includes(column)) {
        return _parseFloat(value);
      } else if (['d1', 'd2', 'flag'].includes(column)) {
        return _parseInt(value);
      } else if (column === 'private') {
        return Boolean(_parseInt(value));
      } else {
        return _parseString(value);
      }
    },
  })) {
    if (record.date === 'Date') {
      // ignore header line
      continue;
    }

    if (!record.latitude && !record.longitude) {
      // invalid record, make sure lat/lng say `null` instead of `0`
      record.latitude = null;
      record.longitude = null;
    }

    // in old format, 255 or 999 means "no measurement"
    if (record.d1 === 255 || record.d1 === 999) {
      record.d1 = null;
    }

    if (record.d2 === 255 || record.d2 === 999) {
      record.d2 = null;
    }

    yield record;
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
          return _parseInt(value);

        case 'float':
          return _parseFloat(value);

        case 'string':
          return _parseString(value);
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

/**
 * This function normalizes a User-Agent header for storage in the database. It
 * make sure that we only store the user-agent if it matches the pattern
 * `OBS/*`, and extracts that part of the user agent, if it contains more
 * information. This is the only part we are interested in, the
 * remainder is too privacy sensitive to keep.
 */
function normalizeUserAgent(userAgent) {
  if (!userAgent) {
    return null;
  }

  const match = userAgent.match(/\bOBS\/[^\s]+/);
  if (match) {
    return match[0];
  }

  return null;
}

module.exports = {
  detectFormat,
  normalizeUserAgent,
  parseObsver1,
  parseObsver2,
  parseTrackPoints,
  replaceDollarNewlinesHack,
};
