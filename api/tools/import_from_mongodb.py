#!/usr/bin/env python3
import argparse
import asyncio
import logging
import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select

from motor.motor_asyncio import AsyncIOMotorClient

from obs.api.db import make_session, connect_db, User, Track, Comment
from obs.api.app import app

log = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="processes a single track for use in the portal, "
        "using the obs.face algorithms"
    )

    parser.add_argument(
        "mongodb_url",
        metavar="MONGODB_URL",
        help="url to the mongodb, in format mongodb://user:pass@host/dbname",
    )

    parser.add_argument(
        "--keycloak-users-file",
        metavar="FILE",
        type=argparse.FileType("wt", encoding="utf-8"),
        help="a file to write a JSON of all old users to, for importing to keycloak",
        default=None,
    )

    args = parser.parse_args()

    async with connect_db(app.config.POSTGRES_URL):
        async with make_session() as session:
            mongo = AsyncIOMotorClient(args.mongodb_url).get_default_database()

            log.debug("Connected to mongodb and postgres.")
            user_id_map = await import_users(mongo, session, args.keycloak_users_file)

            await import_tracks(mongo, session, user_id_map)

            await session.commit()


async def import_users(mongo, session, keycloak_users_file):
    keycloak_users = []

    old_id_by_email = {}
    async for user in mongo.users.find({}):
        old_id_by_email[user["email"]] = user["_id"]

        new_user = User(
            sub=str(uuid4()),
            email=user["email"],
            username=user["username"],
            bio=user.get("bio"),
            image=user.get("image"),
            are_tracks_visible_for_all=user.get("areTracksVisibleForAll") or False,
            api_key=str(user["_id"]),
            created_at=user.get("createdAt") or datetime.utcnow(),
            updated_at=user.get("updatedAt") or datetime.utcnow(),
            match_by_username_email=True,
        )

        if keycloak_users_file:
            needs_email_verification = user.get("needsEmailValidation", True)
            required_actions = ["UPDATE_PASSWORD"]
            if needs_email_verification:
                required_actions.append("VERIFY_EMAIL")

            keycloak_users.append(
                {
                    "username": new_user.username,
                    "email": new_user.email,
                    "enabled": True,
                    "requiredActions": required_actions,
                    "emailVerified": not needs_email_verification,
                }
            )

        session.add(new_user)
        log.info("Creating user %s", new_user.username)

    await session.commit()

    id_map = {}
    result = await session.scalars(select(User))
    for user in result:
        id_map[old_id_by_email[user.email]] = user.id

    if keycloak_users_file:
        json.dump({"users": keycloak_users}, keycloak_users_file, indent=4)
        log.info("Wrote keycloak users file to %s.", keycloak_users_file.name)

    return id_map


def parse_datetime(s):
    if isinstance(s, str):
        return datetime.fromisoformat(s)
    return s


async def import_tracks(mongo, session, user_id_map):
    track_count = 0

    async for track in mongo.tracks.find({}):
        stats = track.get("statistics") or {}
        new_track = Track(
            created_at=parse_datetime(track.get("createdAt")) or datetime.utcnow(),
            updated_at=parse_datetime(track.get("updatedAt")) or datetime.utcnow(),
            slug=track["slug"],
            title=track.get("title"),
            processing_status=track.get("processingStatus") or "pending",
            processing_log=track.get("processingLog"),
            customized_title=bool(track.get("customizedTitle")),
            description=track.get("description"),
            public=track.get("public"),
            uploaded_by_user_agent=track.get("uploadedByUserAgent"),
            original_file_name=track.get("originalFileName"),
            original_file_hash=track.get("originalFileHash"),
            # statistics
            recorded_at=parse_datetime(stats.get("recordedAt")),
            recorded_until=parse_datetime(stats.get("recordedUntil")),
            duration=stats.get("duration"),
            length=stats.get("length"),
            segments=stats.get("segments"),
            num_events=stats.get("num_events"),
            num_measurements=stats.get("num_measurements"),
            num_valid=stats.get("numValid"),
            author_id=user_id_map[track["author"]],
        )

        session.add(new_track)

        comment_ids = track.get("comments") or []
        if comment_ids:
            async for comment in mongo.comments.find({"_id": {"$in": comment_ids}}):
                new_comment = Comment(
                    created_at=parse_datetime(comment.get("createdAt"))
                    or datetime.utcnow(),
                    updated_at=parse_datetime(comment.get("updatedAt"))
                    or datetime.utcnow(),
                    body=comment.get("body"),
                    author_id=user_id_map[comment["author"]],
                )
                new_track.comments.append(new_comment)
                session.add(new_comment)

        track_count += 1

    log.info("Created %s tracks", track_count)

    await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
