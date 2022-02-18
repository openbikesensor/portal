#!/usr/bin/env python3

import math
import sys
import os
import argparse
import asyncio
import logging

import coloredlogs

from obs.api.app import app
from obs.api.db import connect_db

log = logging.getLogger(__name__)


def format_size(n, b=1024):
    if n == 0:
        return "0 B"
    if n < 0:
        return "-" + format_size(n, b)
    e = math.floor(math.log(n, b))
    prefixes = ["", "Ki", "Mi", "Gi", "Ti"] if b == 1024 else ["", "K", "M", "G", "T"]
    e = min(e, len(prefixes) - 1)
    r = n / b**e
    s = f"{r:0.2f}" if e > 0 else str(n)
    return f"{s} {prefixes[e]}B"


class AccessLogFilter(logging.Filter):
    def filter(self, record):
        if not record.msg:
            record.msg = (
                f"{record.request} - {record.status} ({format_size(record.byte)})"
            )
        return True


def main():
    debug = app.config.DEBUG

    coloredlogs.install(
        level=logging.DEBUG if app.config.get("VERBOSE", debug) else logging.INFO,
        milliseconds=True,
        isatty=True,
    )

    for ln in ["sanic.root", "sanic.error", "sanic.access"]:
        l = logging.getLogger(ln)
        for h in list(l.handlers):
            l.removeHandler(h)

    logging.getLogger("sanic.access").addFilter(AccessLogFilter())

    app.run(
        host=app.config.HOST,
        port=app.config.PORT,
        debug=debug,
        auto_reload=app.config.get("AUTO_RELOAD", debug),
        # access_log=False,
    )


if __name__ == "__main__":
    main()
