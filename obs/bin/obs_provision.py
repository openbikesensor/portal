import argparse
import asyncio
import ipaddress
import logging
import os
import re
import sys

import coloredlogs
import httpx

log = logging.getLogger(__name__)

class DevicesContainer:
    def __init__(self, filename):
        self.filename = filename
        self._addresses = None

    @property
    def addresses(self):
        if self._addresses is None:
            self.load()
        return self._addresses

    def load(self):
        try:
            with open(self.filename, 'r') as f:
                self._addresses = set(filter(lambda x: x, (line.strip() for line in f.readlines())))
        except:
            self._addresses = set()

    def append_addresses(self, addresses):
        self._addresses = self.addresses | set(addresses)

    def remove_addresses(self, addresses):
        self._addresses = self.addresses - set(addresses)

    def set_addresses(self, addresses):
        self._addresses = set(addresses)

    def write(self):
        log.debug("Writing %s addresses to devices file %s", len(self._addresses), self.filename)
        with open(self.filename, 'w') as f:
            f.write('\n'.join(self._addresses) + '\n')

async def get_host_info(address, timeout=5):
    """
    Probes a host for whether it is a OpenBikeSensor device. Returns `None` if
    the devices does not appear to be an OpenBikeSensor device. Returns a dict
    with information about the device otherwise. The device has to be in server
    mode.
    """
    async with httpx.AsyncClient() as client:
        try:
            log.debug('[%s] Request information', address)
            response = await client.get(f'http://{address}/about', timeout=timeout)
            text = response.text

        except httpx.ConnectError:
            log.debug('[%s] Connection failed', address)
            return None

    firmware_match = re.search(r'Firmware version: (v\d+\.\d+\.\d+)', text)
    if not firmware_match:
        log.debug('[%s] No firmware version found in response', address)
        return None
    firmware = firmware_match.group(1)

    chip_id_match = re.search(r'Chip id:(</b>)?\s*([0-9A-F]+)', text)
    if not chip_id_match:
        log.debug('[%s] No chip ID found in response', address)
        return None
    chip_id= chip_id_match.group(2)

    log.debug('[%s] Chip ID: %s, Firmware version: %s', address, chip_id, firmware)
    return {"address": address, "firmware": firmware, "chip_id": chip_id}


def list_ips(ip_ranges):
    for ip_range in ip_ranges:
        for address in ipaddress.ip_network(ip_range):
            yield str(address)

async def list_sd_dir(address, path='/'):
    async with httpx.AsyncClient() as client:
        response = await client.get(f'http://{address}/sd?path={path}', timeout=5)
        text = response.text

    directories = set()
    for m in re.finditer(r'<li class="directory"><a href="/sd\?path=([^"]+)">', text):
        directories.add(m.group(1))

    files = set()
    for m in re.finditer(r'<li class="file"><a href="/sd\?path=([^"]+)">', text):
        files.add(m.group(1))

    return directories, files
        # '<li class="file"><a href="/sd?path=/current_14d.alp">&#x1F4C4;current_14d.alp</a></li>'

async def list_sd_dir_deep(address):
    paths = ['/']
    all_files = []
    while paths:
        path = paths.pop()
        directories, files = await list_sd_dir(address, path)
        paths += list(directories)
        all_files += list(files)
    return all_files

async def download_file(address, path, target_directory, keep_directory_structure=False):
    target_file = path.strip('/')
    if not keep_directory_structure:
        target_file = os.path.basename(target_file)

    target_file = os.path.join(target_directory, target_file)

    os.makedirs(os.path.dirname(target_file), exist_ok=True)

    log.debug("[%s] Downloading %s to %s", address, path, target_file)

    async with httpx.AsyncClient() as client:
        async with client.stream('GET', f'http://{address}/sd?path={path}') as response:
            with open(target_file, 'wb') as f:
                async for chunk in response.aiter_bytes():
                    f.write(chunk)

async def command_download(args):
    addresses = args.addresses or args.devices.addresses
    log.info("Downloading files from %s devices", len(addresses))

    # Run downloads asynchronously. We use one task for each device, to not
    # overload it. We avoid parallel requests to the same device by using a
    # sequential logic (see download_from_device) for each device, but we can
    # easily process multiple devices simultaneously.
    results = await asyncio.gather(*map(lambda address: download_from_device(args, address), addresses),
            return_exceptions=True)

    errors = [r for r in results if isinstance(r, Exception)]

    if len(errors):
        log.error("Download failed for %s devices", len(errors))
        sys.exit(1)
    else:
        log.info("Download from %s devices successful.", len(addresses))

async def download_from_device(args, address):
    log.info("[%s] Starting download", address)
    host = await get_host_info(address)

    if host is None:
        log.error("[%s] Failed to download from this device, no information available", address)
        raise ValueError("No compatible device found at %s" % address)

    # TODO: Map from Chip ID to some other alias
    target_directory = os.path.join(args.target_directory, host['chip_id'])
    log.debug("[%s] Storing files in %s", address, target_directory)

    log.debug("[%s] Reading file index", address)
    file_paths = await list_sd_dir_deep(address)

    for path in file_paths:
        if path.endswith('.obsdata.csv'):
            await download_file(address, path, target_directory, keep_directory_structure=args.keep_directory_structure)



async def command_scan(args):
    ips = list(list_ips(args.ip_ranges))

    if len(ips) > 256:
        log.error("Please do not scan more than 256 IPs at once.")
        sys.exit(1)

    log.info("Scanning %s addresses", len(ips))

    results = await asyncio.gather(*map(get_host_info, ips))
    hosts = [r for r in results if r is not None]

    log.info("Found %s devices", len(hosts))

    new_devices = [host['address'] for host in hosts]

    if args.append:
        args.devices.append_addresses(new_devices)
        args.devices.write()
    elif args.write:
        args.devices.set_addresses(new_devices)
        args.devices.write()
    else:
        print('\n'.join(new_devices))

async def command_devices_list(args):
    print('\n'.join(args.devices.addresses))

async def command_devices_add(args):
    old_addresses = args.devices.addresses

    args.devices.append_addresses(args.addresses)
    args.devices.write()

    difference = len(args.devices.addresses) - len(old_addresses)
    log.debug("Added %s devices", difference)

async def command_devices_remove(args):
    old_addresses = args.devices.addresses

    args.devices.remove_addresses(args.addresses)
    args.devices.write()

    difference = len(old_addresses) - len(args.devices.addresses)
    log.debug("Removed %s devices", difference)


def main():
    parser = argparse.ArgumentParser(description='configures and manages OpenBikeSensor devices from the command line')
    parser.add_argument('-d', '--devices-file', help='path to a file that contains list of devices', default="devices.txt", type=DevicesContainer, dest='devices')
    parser.add_argument('-v', '--verbose', action='store_true', help='be verbose')
    subparsers = parser.add_subparsers()

    parser_scan = subparsers.add_parser('scan', help='scan for available devices in the network')
    parser_scan.add_argument('ip_ranges', nargs='+', help='IP range(s) to use for scanning, in CIDR notation, e.g. 172.16.0.0/24')
    parser_scan.add_argument('-a', '--append', action='store_true', help='append found devices to device file')
    parser_scan.add_argument('-w', '--write', action='store_true', help='write found devices to device file (overwrite existing)')
    parser_scan.set_defaults(func=command_scan)

    parser_download = subparsers.add_parser('download', help='download files from all devices')
    parser_download.add_argument('--keep-directory-structure', action='store_true', default=False, help='keep directory structure from device, do not flatten')
    parser_download.add_argument('-t', '--target-directory', default='data/download', help='where to store target files')
    parser_download.add_argument('addresses', nargs='*', help='which devices to download data from (leave empty to use devices file)')
    parser_download.set_defaults(func=command_download)

    parser_devices = subparsers.add_parser('devices', help='manage configured devices')
    subparsers_devices = parser_devices.add_subparsers()

    parser_devicess_list = subparsers_devices.add_parser('list', help='list all devices')
    parser_devicess_list.set_defaults(func=command_devices_list)

    parser_devices_add = subparsers_devices.add_parser('add', help='add devices')
    parser_devices_add.add_argument('addresses', nargs='+', help='the IP of the device')
    parser_devices_add.set_defaults(func=command_devices_add)

    parser_devices_remove = subparsers_devices.add_parser('remove', help='remove devices')
    parser_devices_remove.add_argument('addresses', nargs='+', help='the IPs of the devices to remove')
    parser_devices_remove.set_defaults(func=command_devices_remove)

    args = parser.parse_args()

    coloredlogs.install(level=logging.DEBUG if args.verbose else logging.INFO,
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s")
    logging.getLogger('asyncio').setLevel(logging.INFO)
    logging.getLogger('httpx').setLevel(logging.INFO)

    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
