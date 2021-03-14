import sys


class MeasurementFilter:

    def __init__(self, remove_invalid=True,
                 remove_unconfirmed=True):
        self.remove_invalid = remove_invalid
        self.remove_unconfirmed = remove_unconfirmed
        self.required_fields = ["time", "longitude", "latitude", "confirmed", "distance_overtaker"]

    def filter(self, measurements, log=sys.stdout):
        # filter out unconfirmed measurements
        if self.remove_unconfirmed:
            n = len(measurements)
            measurements = [m for m in measurements
                            if m["confirmed"] is True]
            log.write("filtered for confirmed only measurements: kept {} of {}\n".format(len(measurements), n))

        if self.remove_invalid:
            n = len(measurements)
            measurements = [m for m in measurements if
                            all(f in m and m[f] is not None for f in self.required_fields)
                            ]
            log.write("filtered for valid only measurements: kept {} of {}\n".format(len(measurements), n))

        return measurements
