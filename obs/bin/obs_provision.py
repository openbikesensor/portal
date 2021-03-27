import asyncio
import argparse
import logging
import ipaddress
import re
import sys

import coloredlogs
import httpx

log = logging.getLogger(__name__)

async def get_host_info(host, timeout=5):
    """
    Probes a host for whether it is a OpenBikeSensor device. Returns `None` if
    the devices does not appear to be an OpenBikeSensor device. Returns a dict
    with information about the device otherwise. The device has to be in server
    mode.
    """
    async with httpx.AsyncClient() as client:
        try:
            log.debug('Scanning %s', host)
            response = await client.get(f'http://{host}/about', timeout=timeout)
            text = response.text

            log.debug('Host %s replied, parsing response', host)
            firmware_match = re.search(r'Firmware version: (v\d+\.\d+\.\d+)', text)
            if not firmware_match:
                log.debug('No firmware version found in host %s response', host)
                return None
            firmware = firmware_match.group(1)

            chip_id_match = re.search(r'Chip id:(</b>)?\s*([0-9A-F]+)', text)
            if not chip_id_match:
                log.debug('No chip ID found in host %s response', host)
                return None
            chip_id= chip_id_match.group(2)

            log.debug('Host %s is chip ID %s, running firmware version %s', host, chip_id, firmware)
            return {"host": host, "firmware": firmware, "chip_id": chip_id}

        except httpx.ConnectError:
            log.debug('Host %s connection failed', host)
            return None

async def download_files(host, target_directory, keep_directory_structure=False):
    file_paths = await list_file_paths(host)
    print(file_paths)

def list_ips(ip_ranges):
    for ip_range in ip_ranges:
        for host in ipaddress.ip_network(ip_range):
            yield str(host)

async def command_download(args):
    pass

async def command_scan(args):
    ips = list(list_ips(args.ip_ranges))

    if len(ips) > 256:
        log.error("Please do not scan more than 256 IPs at once.")
        sys.exit(1)

    results = await asyncio.gather(*map(get_host_info, ips))
    hosts = [r for r in results if r is not None]

    new_devices = set(host['host'] for host in hosts)

    if args.append:
        devices = load_devices(args.devices_file) | new_devices
        write_devices(args.devices_file, devices)
    elif args.write:
        write_devices(args.devices_file, new_devices)

def load_devices(devices_file):
    try:
        with open(devices_file, 'r') as f:
            return set(filter(lambda x: x, (line.strip() for line in f.readlines())))
    except:
        return set()

def write_devices(devices_file, devices):
    log.debug("writing %s devices to file %s", len(devices), devices_file)
    with open(devices_file, 'w') as f:
        f.write('\n'.join(devices) + '\n')

def main():
    parser = argparse.ArgumentParser(description='configures and manages OpenBikeSensor devices from the command line')
    parser.add_argument('-d', '--devices-file', help='path to a file that contains list of devices', default="devices.txt")
    parser.add_argument('-v', '--verbose', action='store_true', help='be verbose')
    subparsers = parser.add_subparsers(help='sub-command help')

    parser_scan = subparsers.add_parser('scan', help='scan for available devices in the network')
    parser_scan.add_argument('ip_ranges', nargs='+', help='IP range(s) to use for scanning, in CIDR notation, e.g. 127.16.0.0/24')
    parser_scan.add_argument('-a', '--append', action='store_true', help='append found devices to device file')
    parser_scan.add_argument('-w', '--write', action='store_true', help='write found devices to device file (overwrite existing)')
    parser_scan.set_defaults(func=command_scan)

    parser_download = subparsers.add_parser('download', help='download files from all devices')
    parser_download.add_argument('--keep-directory-structure', action='store_true', help='keep directory structure from device, do not flatten')
    parser_download.add_argument('--target-directory', required=True, help='where to store target files')
    parser_download.set_defaults(func=command_download)

    args = parser.parse_args()

    coloredlogs.install(level=logging.DEBUG if args.verbose else logging.INFO,
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s")

    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
