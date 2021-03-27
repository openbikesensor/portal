# obs-provision

This is a command line utility to manage multiple OpenBikeSensor devices at once. 

## Prequisites

* Your devices are all configured to join the same WiFi network, and your PC is
  also in this network. 
* You have control over the IP addresses assigned to the devices, or they are
  explicitly known to you, or they are within a known subnet of max. 256
  devices.
* The devices are all running **firmware version 0.4.x**. This tool is not yet
  compatible with the added security measures from firmware v0.5 and onwards.
  Support will be added later.
* You have installed this whole toolkit as described in the general
  [Installation Instructions](../README.md).

## Guide

### Set up your WiFi

Depending on your operating system and environment, you may be able to set up a
WiFi hotspot on your PC, or have all devices join another WiFi. Your PC must be
in the same subnet as the devices, and must be able to address those devices by
IP directly. How to set up such a network is beyond the scope of this
documentation, but a normal home network where devices are allowed (in the
router settings) to communicate with each other should be the common case, and
is sufficient.

Your devices must be configured through other means to join this WiFi. The
firmware and this tool do not support ad-hoc configuration of the WiFi
credentials (yet). Make sure when setting up multiple devices initially to
already configure the WiFi credentials correctly. You can do so by storing a
specially formatted configuration file on each SD card and inserting those into
the devices.

Going forward, we assume that your local network is configured to give each
device an IP address in the range from `192.168.0.128` to `192.168.0.191`, and
that your local computer has the IP in that range ending in `.128`.

### Switch on all devices

The devices have to be started in **server mode**, i.e. they have to connect to
WiFi. To do so, switch them on one-by-one, pressing the button on the display
while doing so. The devices should start, connect to the WiFi, and display
their IP. If this does not work, refer to the
[Firmware](https://github.com/openbikesensor/OpenBikeSensorFirmware) repository
for details, troubleshooting, or help resources.

### Write device file or scan for devices

If you know the IPs of all devices in your network that you want to manage,
write those IPs in a single file, one on each line, and call it `devices.txt`. Example:

    192.168.0.128
    192.168.0.129
    192.168.0.130
    192.168.0.140
    
To automatically generate this file by detecting available devices that appear
to OpenBikeSensor devices, run the scan command:

    obs-provision scan 192.168.0.128/26 --append
    
You have to provide one or more valid IP-ranges in [CIDR
notation](https://en.wikipedia.org/wiki/CIDR_notation#CIDR_notation). If your
IP range does not align properly to one of those, provide it in multiple
slices, or provide a range that is bigger than the target range. All IPs will
be scanned, but if there is not device at that IP, it will be skipped.

You can run the command with `--append` multiple times, or overwrite the
existing device file with the scan results with `--write` instead.

You can also configure the list of devices with the `obs-provision devices`
command. Run the following command for help:

    obs-provision devices --help
    
When working with multiple device files, you can always, in any command,
specify the `--devices-file` on the command line. This has to be done after the
`obs-provision` command, but before your chosen subcommand (e.g. `devices`):

    obs-provision --devices-file ~/my-devices.txt devices list

### Download all files
