from datetime import datetime
import logging
import queue
import tarfile
from os.path import commonpath, relpath, join

import dateutil.parser

from sanic.exceptions import InvalidUsage

log = logging.getLogger(__name__)

RAISE = object()


def get_single_arg(req, name, default=RAISE, convert=None):
    try:
        value = req.args[name][0]
    except LookupError as e:
        if default is RAISE:
            raise InvalidUsage(f"missing `{name}`") from e

        value = default

    if convert is not None and value is not None:
        if convert is datetime or convert in ("date", "datetime"):
            convert = lambda s: dateutil.parser.parse(s)

        try:
            value = convert(value)
        except (ValueError, TypeError) as e:
            raise InvalidUsage(f"invalid `{name}`: {str(e)}") from e

    return value


def round_to(value: float, multiples: float) -> float:
    if value is None:
        return None
    return round(value / multiples) * multiples


def chunk_list(lst, n):
    for s in range(0, len(lst), n):
        yield lst[s : s + n]


class chunk:
    def __init__(self, iterable, n):
        self.iterable = iterable
        self.n = n

    def __iter__(self):
        if isinstance(self.iterable, list):
            yield from chunk_list(self.iterable, self.n)
            return

        it = iter(self.iterable)
        while True:
            current = []
            try:
                for _ in range(self.n):
                    current.append(next(it))
                yield current
            except StopIteration:
                if current:
                    yield current
                break

    async def __aiter__(self):
        if hasattr(self.iterable, "__iter__"):
            for item in self:
                yield item
            return

        it = self.iterable.__aiter__()
        while True:
            current = []
            try:
                for _ in range(self.n):
                    current.append(await it.__anext__())
                yield current
            except StopAsyncIteration:
                if len(current):
                    yield current
                break


async def tar_of_tracks(req, files, file_basename="tracks"):
    response = await req.respond(
        content_type="application/x-gtar",
        headers={
            "content-disposition": f'attachment; filename="{file_basename}.tar.bz2"'
        },
    )

    helper = StreamerHelper(response)

    tar = tarfile.open(name=None, fileobj=helper, mode="w|bz2", bufsize=256 * 512)

    root = commonpath(list(files))
    for fname in files:
        log.info("Write file to tar: %s", fname)
        with open(fname, "rb") as fobj:
            tarinfo = tar.gettarinfo(fname)
            tarinfo.name = join(file_basename, relpath(fname, root))
            tar.addfile(tarinfo, fobj)
            await helper.send_all()
    tar.close()
    await helper.send_all()

    await response.eof()


class StreamerHelper:
    def __init__(self, response):
        self.response = response
        self.towrite = queue.Queue()

    def write(self, data):
        self.towrite.put(data)

    async def send_all(self):
        while True:
            try:
                tosend = self.towrite.get(block=False)
                await self.response.send(tosend)
            except queue.Empty:
                break
