#!/usr/bin/env python3

import sys
import os
import argparse
import asyncio

from obs.api.app import app
from obs.api.db import connect_db


def main():
    app.run(host=app.config.HOST, port=app.config.PORT, debug=app.config.DEBUG)


if __name__ == "__main__":
    main()
