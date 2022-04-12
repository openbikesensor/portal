from os.path import join, exists, isfile, abspath

import sanic.response as response
from sanic.exceptions import NotFound

from obs.api.app import app

if app.config.FRONTEND_CONFIG:

    @app.get("/config.json")
    def get_frontend_config(req):
        result = {
            "basename": req.ctx.frontend_base_path,
            **req.app.config.FRONTEND_CONFIG,
            "apiUrl": f"{req.ctx.api_url}/api",
            "loginUrl": f"{req.ctx.api_url}/login",
            "obsMapSource": (
                None
                if app.config.LEAN_MODE
                else {
                    "type": "vector",
                    "tiles": [
                        req.ctx.api_url
                        + req.app.url_for("tiles", zoom="000", x="111", y="222.pbf")
                        .replace("000", "{z}")
                        .replace("111", "{x}")
                        .replace("222", "{y}")
                    ],
                    "minzoom": 12,
                    "maxzoom": 14,
                }
            ),
        }

        return response.json(result)


INDEX_HTML = (
    join(app.config.FRONTEND_DIR, "index.html")
    if app.config.get("FRONTEND_DIR")
    else None
)
if INDEX_HTML and exists(INDEX_HTML):
    with open(INDEX_HTML, "rt") as f:
        index_file_contents = f.read()

    @app.get("/<path:path>")
    def get_frontend_static(req, path):
        if path.startswith("api/"):
            raise NotFound()

        file = join(app.config.FRONTEND_DIR, path)
        if not abspath(file).startswith(abspath(app.config.FRONTEND_DIR)):
            raise NotFound()

        if not exists(file) or not path or not isfile(file):
            return response.html(
                index_file_contents.replace("__BASE_HREF__", req.ctx.frontend_url + "/")
            )

        return response.file(file)
