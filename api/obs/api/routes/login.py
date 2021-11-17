import logging
import os

from sqlalchemy import select

from oic import rndstr
from oic.oic import Client
from oic.oic.message import AuthorizationResponse, RegistrationResponse
from oic.utils.authn.client import CLIENT_AUTHN_METHOD

from obs.api.app import auth
from obs.api.db import User

from sanic.response import json, redirect
from sanicargs import parse_parameters

log = logging.getLogger(__name__)

client = Client(client_authn_method=CLIENT_AUTHN_METHOD)


@auth.before_server_start
async def connect_auth_client(app, loop):
    client.allow["issuer_mismatch"] = True
    pc = client.provider_config(app.config.KEYCLOAK_URL)
    client.store_registration_info(
        RegistrationResponse(
            client_id=app.config.KEYCLOAK_CLIENT_ID,
            client_secret=app.config.KEYCLOAK_CLIENT_SECRET,
        )
    )


@auth.route("/login")
@parse_parameters
async def login(req, next: str = None):
    session = req.ctx.session
    session["state"] = rndstr()
    session["nonce"] = rndstr()
    session["next"] = next
    args = {
        "client_id": client.client_id,
        "response_type": "code",
        "scope": ["openid"],
        "nonce": session["nonce"],
        "redirect_uri": req.scheme + "://" + req.host + "/login/redirect",
        "state": session["state"],
    }

    auth_req = client.construct_AuthorizationRequest(request_args=args)
    login_url = auth_req.request(client.authorization_endpoint)

    return redirect(login_url)


@auth.route("/login/redirect")
async def login_redirect(req):
    session = req.ctx.session

    auth_response = client.parse_response(
        AuthorizationResponse, info=dict(req.query_args), sformat="dict"
    )
    code = auth_response["code"]
    state = auth_response["state"]

    assert "state" in session
    assert state == session["state"]

    client.do_access_token_request(
        state=state,
        request_args={"code": code},
        authn_method="client_secret_basic",
    )

    userinfo = client.do_user_info_request(state=state)

    # {'sub': '3798e2da-b208-4a1a-98c0-08fecfea1345', 'email_verified': True, 'preferred_username': 'test', 'email': 'test@example.com'}
    sub = userinfo["sub"]
    preferred_username = userinfo["preferred_username"]
    email = userinfo["email"]

    user = (await req.ctx.db.execute(select(User).where(User.sub == sub))).scalar()

    if user is None:
        user = (
            await req.ctx.db.execute(
                select(User).where(
                    User.email == email
                    and User.username == preferred_username
                    and User.match_by_username_email
                )
            )
        ).scalar()

        if user:
            log.info(
                "Re-matched existing user %s (sub: %s) based on email and username (%s)",
                user.id,
                user.sub,
                preferred_username,
            )
            user.match_by_username_email = False
            user.sub = sub

    if user is None:
        log.info(
            "Registering new user with sub %r (preferred username: %s)",
            sub,
            preferred_username,
        )
        user = User(sub=sub, username=preferred_username, email=email)
        req.ctx.db.add(user)
    else:
        log.info("Logged in known user (id: %s, sub: %s).", user.id, user.sub)

        if email != user.email:
            log.debug("Updating user (id: %s) email from auth system.", user.id)
            user.email = email

        if preferred_username != user.username:
            log.debug("Updating user (id: %s) username from auth system.", user.id)
            user.username = preferred_username

    await req.ctx.db.commit()

    session["user_id"] = user.id

    next_ = session.pop("next", "/") or "/"
    return redirect(next_)
