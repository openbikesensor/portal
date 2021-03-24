const request = require('supertest');
const mockingoose = require('mockingoose');
const express = require('express');

const Track = require('../../models/Track');
const User = require('../../models/User');

const stats = require('./stats');

const app = express();

app.use('/stats', stats);

describe('stats', () => {
  it('checks for available trackCount', async () => {
    mockingoose(Track).toReturn(undefined, 'find').toReturn(0, 'count');
    mockingoose(User).toReturn({}, 'find');

    await request(app).get('/stats').expect(200).expect({
      publicTrackCount: 0,
      publicTrackLength: 0,
      trackLength: 0,
      numEvents: 0,
      trackCount: 0,
      trackDuration: 0,
    });
  });

  it('returns with json', async () => {
    mockingoose(Track)
      .toReturn([{}], 'find')
      .toReturn(1, 'count')
      .toReturn(
        [
          {
            trackLength: 1900,
            publicTrackLength: 500,
            numEvents: 1,
            trackDuration: 90,
          },
        ],
        'aggregate',
      );

    mockingoose(User).toReturn({}, 'find');

    await request(app).get('/stats').expect(200).expect({
      publicTrackCount: 1,
      publicTrackLength: 500,
      trackLength: 1000,
      numEvents: 1,
      trackCount: 1,
      trackDuration: 0,
    });
  });
});
