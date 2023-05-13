from collections import defaultdict
from typing import Dict, FrozenSet, Iterable

from sanic import Sanic, response
from sanic_routing.router import Route


def _add_cors_headers(request, response, methods: Iterable[str]) -> None:
    allow_methods = list(set(methods))

    if "OPTIONS" not in allow_methods:
        allow_methods.append("OPTIONS")

    origin = request.headers.get("origin")
    if origin in request.app.ctx.cors_origins:
        headers = {
            "Access-Control-Allow-Methods": ",".join(allow_methods),
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": (
                "origin, content-type, accept, "
                "authorization, x-xsrf-token, x-request-id"
            ),
            "Access-Control-Expose-Headers": "content-disposition",
        }
        response.headers.extend(headers)


def add_cors_headers(request, response):
    if request.method != "OPTIONS":
        methods = [method for method in request.route.methods]
        _add_cors_headers(request, response, methods)


def _compile_routes_needing_options(routes: Dict[str, Route]) -> Dict[str, FrozenSet]:
    needs_options = defaultdict(list)
    # This is 21.12 and later. You will need to change this for older versions.
    for route in routes.values():
        if "OPTIONS" not in route.methods:
            needs_options[route.uri].extend(route.methods)

    return {uri: frozenset(methods) for uri, methods in dict(needs_options).items()}


def _options_wrapper(handler, methods):
    def wrapped_handler(request, *args, **kwargs):
        nonlocal methods
        return handler(request, methods)

    return wrapped_handler


async def options_handler(request, methods) -> response.HTTPResponse:
    resp = response.empty()
    _add_cors_headers(request, resp, methods)
    return resp


def setup_options(app: Sanic, _):
    app.router.reset()
    needs_options = _compile_routes_needing_options(app.router.routes_all)
    for uri, methods in needs_options.items():
        app.add_route(
            _options_wrapper(options_handler, methods),
            uri,
            methods=["OPTIONS"],
        )
    app.router.finalize()
