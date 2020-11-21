const { addPointsToTrack, parseObsver1, detectFormat, parseObsver2, replaceDollarNewlinesHack } = require('./tracks');
const TrackInfo = require('./TrackInfo');

const { test1, test2, test3 } = require('./_tracks_testdata');

describe('addPointsToTrack', () => {
  it('is a function', () => {
    expect(typeof addPointsToTrack).toBe('function');
  });

  it('works on the sample data with an empty track', () => {
    const trackInfo = new TrackInfo({}, { points: [] });
    addPointsToTrack(trackInfo, test1);
    const points = trackInfo.trackData.points;
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
