#!/usr/bin/env python3
import logging
import asyncio
import tempfile
import re
import os
import glob
from os.path import normpath, abspath, join

from sqlalchemy import text
import sqlparse

from obs.api.app import app
from obs.api.db import connect_db, make_session

log = logging.getLogger(__name__)


TILE_GENERATOR = normpath(
    abspath(join(app.config.API_ROOT_DIR, "..", "tile-generator"))
)
TILESET_FILE = join(TILE_GENERATOR, "openbikesensor.yaml")


def parse_pg_url(url=app.config.POSTGRES_URL):
    m = re.match(
        r"^postgresql\+asyncpg://(?P<user>.*):(?P<password>.*)@(?P<host>.*)(:(?P<port>\d+))?/(?P<database>[^/]+)$",
        url,
    )

    return (
        m["user"] or "",
        m["password"] or "",
        m["host"],
        m["port"] or "5432",
        m["database"],
    )


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    with tempfile.TemporaryDirectory() as build_dir:
        await generate_data_yml(build_dir)
        sql_snippets = await generate_sql(build_dir)
        await import_sql(sql_snippets)


async def _run(cmd):
    if isinstance(cmd, list):
        cmd = " ".join(cmd)
    proc = await asyncio.create_subprocess_shell(
        cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )

    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        log.error(stderr.decode("utf-8"))
        raise RuntimeError("external program failed: %s" % str(cmd))

    return stdout.decode("utf-8")


async def generate_data_yml(build_dir):
    stdout = await _run(
        [
            "python",
            "$(which generate-tm2source)",
            TILESET_FILE,
            *sum(
                zip(
                    ["--user", "--password", "--host", "--port", "--database"],
                    parse_pg_url(),
                ),
                (),
            ),
        ]
    )

    tm2source = join(build_dir, "openbikesensor.tm2source")
    os.makedirs(tm2source, exist_ok=True)

    with open(join(tm2source, "data.yml"), "wt") as f:
        f.write(stdout)


async def generate_sql(build_dir):
    sql_dir = join(build_dir, "sql")

    await _run(f"python $(which generate-sql) {TILESET_FILE!r} --dir {sql_dir!r}")

    sql_snippet_files = [
        *sorted(
            glob.glob(
                join(
                    app.config.API_ROOT_DIR, "src", "openmaptiles-tools", "sql", "*.sql"
                )
            )
        ),
        join(sql_dir, "run_first.sql"),
        *sorted(glob.glob(join(sql_dir, "parallel", "*.sql"))),
        join(sql_dir, "run_last.sql"),
    ]

    sql_snippets = [
        "CREATE EXTENSION IF NOT EXISTS hstore;"
        "CREATE EXTENSION IF NOT EXISTS postgis;"
    ]
    for filename in sql_snippet_files:
        with open(filename, "rt") as f:
            sql_snippets.append(f.read())

    getmvt_sql = await _run(
        f"python $(which generate-sqltomvt) {TILESET_FILE!r} --key --gzip --postgis-ver 3.0.1 --function --fname=getmvt"
    )
    sql_snippets.append(getmvt_sql)

    return sql_snippets


async def import_sql(sql_snippets):
    statements = sum(map(sqlparse.split, sql_snippets), [])
    async with connect_db(app.config.POSTGRES_URL):
        for i, statement in enumerate(statements):
            clean_statement = sqlparse.format(
                statement,
                truncate_strings=20,
                strip_comments=True,
                keyword_case="upper",
            )

            if not clean_statement:
                continue

            log.debug(
                "Running SQL statement %d of %d (%s...)",
                i + 1,
                len(statements),
                clean_statement[:40],
            )

            async with make_session() as session:
                await session.execute(text(statement))
                await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
