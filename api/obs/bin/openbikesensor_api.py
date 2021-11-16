#!/usr/bin/env python3

import sys
import os
import argparse
import asyncio

from obs.api.app import app
from obs.api.db import connect_db


def main():
    debug = app.config.DEBUG
    app.run(
        host=app.config.HOST,
        port=app.config.PORT,
        debug=debug,
        auto_reload=app.config.get("AUTO_RELOAD", debug),
    )


if __name__ == "__main__":
    main()
