import logging

from sanic.response import json
from sanic.exceptions import InvalidUsage

from obs.api.app import api, require_auth

log = logging.getLogger(__name__)

from obs.api import __version__ as version


def user_to_json(user):
    return {
        "username": user.username,
        "email": user.email,
        "bio": user.bio,
        "image": user.image,
        "areTracksVisibleForAll": user.are_tracks_visible_for_all,
        "apiKey": user.api_key,
    }


@api.get("/user")
async def get_user(req):
    return json(user_to_json(req.ctx.user) if req.ctx.user else None)


@api.put("/user")
@require_auth
async def put_user(req):
    user = req.ctx.user
    data = req.json

    for key in ["email", "bio", "image"]:
        if key in data and isinstance(data[key], (str, type(None))):
            setattr(user, key, data[key])

    if "areTracksVisibleForAll" in data:
        user.are_tracks_visible_for_all = bool(data["areTracksVisibleForAll"])

    if data.get("updateApiKey"):
        user.generate_api_key()

    await req.ctx.db.commit()
    return json(user_to_json(req.ctx.user))
