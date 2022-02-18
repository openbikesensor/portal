from datetime import datetime
import dateutil.parser
from sanic.exceptions import InvalidUsage

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
