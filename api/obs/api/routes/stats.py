import logging
from datetime import datetime
from typing import Optional
from operator import and_
from functools import reduce

from sqlalchemy import select, func, desc

from sanic.response import json

from obs.api.app import api
from obs.api.db import Track, OvertakingEvent, User, Region
from obs.api.utils import round_to


log = logging.getLogger(__name__)


# round to this number of meters for privacy reasons
TRACK_LENGTH_ROUNDING = 1000

# round to this number of seconds for privacy reasons
TRACK_DURATION_ROUNDING = 120

# Everything before this date is probably parsed incorrectly
MINUMUM_RECORDING_DATE = datetime(2010, 1, 1)


@api.route("/stats")
async def stats(req):
    user = req.ctx.get_single_arg("user", default=None)
    start = req.ctx.get_single_arg("start", default=None, convert=datetime)
    end = req.ctx.get_single_arg("end", default=None, convert=datetime)

    conditions = [
        Track.recorded_at != None,
        Track.recorded_at > MINUMUM_RECORDING_DATE,
    ]

    if start is not None:
        conditions.append(Track.recorded_at >= start)

    if end is not None:
        conditions.append(Track.recorded_at < end)

    # Only the user can look for their own stats, for now
    by_user = (
        user is not None and req.ctx.user is not None and req.ctx.user.username == user
    )
    if by_user:
        conditions.append(Track.author_id == req.ctx.user.id)

    track_condition = reduce(and_, conditions)
    public_track_condition = Track.public and track_condition

    query = (
        select(
            [
                func.count().label("publicTrackCount"),
                func.sum(Track.duration).label("trackDuration"),
                func.sum(Track.length).label("trackLength"),
            ]
        )
        .select_from(Track)
        .where(public_track_condition)
    )

    public_track_count, track_duration, track_length = (
        await req.ctx.db.execute(query)
    ).first()

    # This is required because SQL returns NULL when the input set to a
    # SUM() aggregation is empty.
    track_duration = track_duration or 0
    track_length = track_length or 0

    user_count = (
        1
        if by_user
        else (await req.ctx.db.execute(select(func.count()).select_from(User))).scalar()
    )
    track_count = (
        await req.ctx.db.execute(
            select(func.count()).select_from(Track).where(track_condition)
        )
    ).scalar()
    event_count = (
        await req.ctx.db.execute(
            select(func.count())
            .select_from(OvertakingEvent)
            .join(OvertakingEvent.track)
            .where(track_condition)
        )
    ).scalar()

    result = {
        "numEvents": event_count,
        "userCount": user_count,
        "trackLength": round_to(track_length or 0, TRACK_LENGTH_ROUNDING),
        "trackDuration": round_to(track_duration or 0, TRACK_DURATION_ROUNDING),
        "publicTrackCount": public_track_count,
        "trackCount": track_count,
    }

    return json(result)


#     const trackCount = await Track.find(trackFilter).count();
#
#     const publicTrackCount = await Track.find({
#       ...trackFilter,
#       public: true,
#     }).count();
#
#     const userCount = await User.find({
#       ...(userFilter
#         ? { _id: userFilter }
#         : {
#             createdAt: dateFilter,
#           }),
#     }).count();
#
#     const trackStats = await Track.aggregate([
#       { $match: trackFilter },
#       {
#         $addFields: {
#           trackLength: {
#             $cond: [{ $lt: ['$statistics.length', 500000] }, '$statistics.length', 0],
#           },
#           numEvents: '$statistics.numEvents',
#           trackDuration: {
#             $cond: [
#               { $and: ['$statistics.recordedUntil', { $gt: ['$statistics.recordedAt', new Date('2010-01-01')] }] },
#               { $subtract: ['$statistics.recordedUntil', '$statistics.recordedAt'] },
#               0,
#             ],
#           },
#         },
#       },
#       { $project: { trackLength: true, numEvents: true, trackDuration: true } },
#       {
#         $group: {
#           _id: 'sum',
#           trackLength: { $sum: '$trackLength' },
#           numEvents: { $sum: '$numEvents' },
#           trackDuration: { $sum: '$trackDuration' },
#         },
#       },
#     ]);
#
#     const [trackLength, numEvents, trackDuration] =
#       trackStats.length > 0
#         ? [trackStats[0].trackLength, trackStats[0].numEvents, trackStats[0].trackDuration]
#         : [0, 0, 0];
#
#     const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;
#     const trackDurationPrivatized =
#       Math.round(trackDuration / 1000 / TRACK_DURATION_ROUNDING) * TRACK_DURATION_ROUNDING;
#
#     return res.json({
#       publicTrackCount,
#       trackLength: trackLengthPrivatized,
#       trackDuration: trackDurationPrivatized,
#       numEvents,
#       trackCount,
#       userCount,
#     });
#   }),
# );


@api.route("/stats/regions")
async def stats(req):
    query = (
        select(
            [
                Region.relation_id.label("id"),
                Region.name,
                func.count(OvertakingEvent.id).label("overtaking_event_count"),
            ]
        )
        .select_from(Region)
        .join(
            OvertakingEvent,
            func.ST_Within(
                func.ST_Transform(OvertakingEvent.geometry, 3857), Region.geometry
            ),
        )
        .where(Region.admin_level == 6)
        .group_by(
            Region.relation_id,
            Region.name,
            Region.relation_id,
            Region.admin_level,
            Region.geometry,
        )
        .having(func.count(OvertakingEvent.id) > 0)
        .order_by(desc("overtaking_event_count"))
    )

    regions = list(map(dict, (await req.ctx.db.execute(query)).all()))
    return json(regions)
