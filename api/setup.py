from setuptools import setup, find_packages

with open("requirements.txt", encoding="utf-8") as f:
    requires = list(f.readlines())

setup(
    name="openbikesensor-api",
    version="0.0.1",
    author="OpenBikeSensor Contributors",
    license="LGPL-3.0",
    description="OpenBikeSensor Portal API",
    url="https://github.com/openbikesensor/portal",
    packages=find_packages(),
    package_data={},
    install_requires=requires,
    entry_points={
        "console_scripts": [
            "openbikesensor-api=obs.bin.openbikesensor_api:main",
            "openbikesensor-transform-osm=obs.bin.openbikesensor_transform_osm:main",
            "openbikesensor-face=obs.bin.obs_face:main",
            "openbikesensor-filter-privacy=obs.bin.obs_filter_privacy:main",
            "openbikesensor-process-track=obs.bin.obs_process_track:main",
            "openbikesensor-provision=obs.bin.obs_provision:main",
            # legacy obs- prefix
            "obs-face=obs.bin.obs_face:main",
            "obs-filter-privacy=obs.bin.obs_filter_privacy:main",
            "obs-process-track=obs.bin.obs_process_track:main",
            "obs-provision=obs.bin.obs_provision:main",
        ]
    },
)
