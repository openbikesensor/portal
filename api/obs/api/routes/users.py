import logging

from sanic.response import json

from obs.api.app import app, require_auth

log = logging.getLogger(__name__)

from obs.api import __version__ as version


def user_to_json(user):
    return {
        "username": user.username,
        "email": user.email,
        "bio": user.bio,
        "image": user.image,
        "areTracksVisibleForAll": user.are_tracks_visible_for_all,
        # "apiKey": user.api_key,
    }


@app.get("/user")
@require_auth
async def get_user(req):
    return json(user_to_json(req.ctx.user))


@app.put("/user")
@require_auth
async def put_user(req):
    user = req.ctx.user

    for key in ["username", "email", "bio", "image"]:
        if key in req.json and isinstance(req.json[key], (str, type(None))):
            setattr(user, key, req.json[key])

    if "areTracksVisibleForAll" in req.json:
        user.are_tracks_visible_for_all = bool(req.json["areTracksVisibleForAll"])

    await req.ctx.db.commit()
    return json(user_to_json(req.ctx.user))
