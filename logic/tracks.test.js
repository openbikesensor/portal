const {
  buildObsver1,
  detectFormat,
  normalizeUserAgent,
  parseObsver1,
  parseObsver2,
  parseTrackPoints,
  replaceDollarNewlinesHack,
} = require('./tracks');

const { test1, test2, test3 } = require('./_tracks_testdata');

describe('parseTrackPoints', () => {
  it('is a function', () => {
    expect(typeof parseTrackPoints).toBe('function');
  });

  it('works on the sample data with an empty track', () => {
    const points = Array.from(parseTrackPoints(test1));
    expect(points).toHaveLength(324);
    expect(points[0]).toEqual({
      date: '12.07.2020',
      time: '09:02:59',
      latitude: null,
      longitude: null,
      course: 0,
      speed: 0,
      d1: null,
      d2: null,
      flag: 0,
      private: false,
    });
  });
});

describe('parseObsver1', () => {
  it('can parse sample data', () => {
    const points = Array.from(parseObsver1(replaceDollarNewlinesHack(test1)));
    expect(points).toHaveLength(324);
    expect(points[0]).toEqual({
      date: '12.07.2020',
      time: '09:02:59',
      latitude: null,
      longitude: null,
      course: 0,
      speed: 0,
      d1: null,
      d2: null,
      flag: 0,
      private: false,
    });
  });
});

describe('parseObsver2', () => {
  it('can parse sample data', () => {
    const points = Array.from(parseObsver2(test2));
    expect(points).toHaveLength(18);
    expect(points[0]).toEqual({
      date: '18.11.2020',
      time: '16:05:59',
      latitude: 48.723224,
      longitude: 9.094103,
      course: 189.86,
      speed: 3.2,
      d1: 770,
      d2: null,
      flag: false,
      private: true,
    });

    // this is a non-private, flagged point (i.e. "Confirmed" overtaking)
    expect(points[17]).toEqual({
      date: '18.11.2020',
      time: '16:06:16',
      latitude: 48.723109,
      longitude: 9.093963,
      course: 247.62,
      speed: 0,
      d1: 5,
      d2: 89,
      flag: true,
      private: false,
    });
  });
});

describe('detectFormat', () => {
  it('detects format 1', () => {
    expect(detectFormat(test1)).toBe(1);
  });

  it('detects format 2', () => {
    expect(detectFormat(test2)).toBe(2);
    expect(detectFormat(test3)).toBe(2);
  });

  it('detects invalid format', () => {
    expect(detectFormat('foobar\nbaz')).toBe('invalid');
    expect(detectFormat('')).toBe('invalid');
  });
});

describe('normalizeUserAgent', () => {
  it('is a function', () => {
    expect(typeof normalizeUserAgent).toBe('function');
  });

  it('ignores falsy values', () => {
    expect(normalizeUserAgent(null)).toBe(null);
    expect(normalizeUserAgent('')).toBe(null);
  });

  it('ignores normal browser agents', () => {
    const browserAgents = [
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 6P Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.83 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 6.0; HTC One M9 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.98 Mobile Safari/537.3',
      'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A5370a Safari/604.1',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
    ];

    for (const browserAgent of browserAgents) {
      expect(normalizeUserAgent(browserAgent)).toBe(null);
    }
  });

  it('detects OBS versions', () => {
    const agents = ['OBS/123', 'OBS/2', 'OBS/1.2.3.4.5-rc123'];

    for (const agent of agents) {
      expect(normalizeUserAgent(agent)).toBe(agent);
    }
  });

  it('extracts OBS versions from extended formats', () => {
    const agents = ['foo OBS/123', 'OBS/123 bar', 'foo OBS/123 bar'];

    for (const agent of agents) {
      expect(normalizeUserAgent(agent)).toBe('OBS/123');
    }
  });
});

describe('buildObsver1', () => {
  it('is a function', () => {
    expect(typeof normalizeUserAgent).toBe('function');
  });

  it('transforms properly back and forth', () => {
    const inputString = replaceDollarNewlinesHack(test1);

    const points1 = Array.from(parseObsver1(inputString));
    const builtString = buildObsver1(points1);
    const points2 = Array.from(parseObsver1(builtString));

    expect(points2).toEqual(points1);
  });

  it('produces a header', () => {
    const builtString = buildObsver1([]);
    expect(builtString).toBe('Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed;insidePrivacyArea\n');
  });

  it('produces empty rows', () => {
    const builtString = buildObsver1([{}]);
    expect(builtString).toBe(
      'Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed;insidePrivacyArea\n;;;;;;;;;\n',
    );
  });
});
