const { addPointsToTrack } = require('./tracks');
const TrackInfo = require('./TrackInfo');

const { test1 } = require('./_tracks_testdata');

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
      latitude: 0,
      longitude: 0,
      course: 0,
      speed: 0,
      d1: '255',
      d2: '255',
      flag: '0',
      private: '0',
    });
  });
});
