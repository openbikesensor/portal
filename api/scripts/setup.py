from setuptools import setup, find_packages

with open("requirements.txt") as f:
    requires = list(f.readlines())

setup(
    name="obs-face",
    version="0.0.1",
    author="OpenBikeSensor Contributors",
    license="LGPL-3.0",
    description="OpenBikeSensor Scripts Collection",
    url="https://github.com/openbikesensor/OpenBikeSensor-Scripts",
    packages=find_packages(),
    package_data={},
    install_requires=requires,
    entry_points={
        "console_scripts": [
            "obs-face=obs.bin.obs_face:main",
            "obs-filter-privacy=obs.bin.obs_filter_privacy:main",
            "obs-process-track=obs.bin.obs_process_track:main",
            "obs-provision=obs.bin.obs_provision:main",
        ]
    },
)
