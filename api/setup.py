from setuptools import setup, find_packages

with open("requirements.txt") as f:
    requires = list(f.readlines())

setup(
    name="obs-api",
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
            "obs-api=obs.bin.obs_api:main",
        ]
    },
)
