from setuptools import setup, find_packages

setup(
    name="openbikesensor-api",
    version="0.0.1",
    author="OpenBikeSensor Contributors",
    license="LGPL-3.0",
    description="OpenBikeSensor Portal API",
    url="https://github.com/openbikesensor/portal",
    packages=find_packages(),
    package_data={},
    install_requires=[
        "coloredlogs~=15.0.1",
        "sanic~=21.9.3",
        "oic>=1.3.0, <2",
        "sanic-session~=0.8.0",
        "sanic-cors~=2.0.1",
        "python-slugify>=5.0.2,<6.2.0",
        "motor~=2.5.1",
        "pyyaml<6",
        "sqlparse~=0.4.2",
        "openmaptiles-tools",  # install from git
        "pyshp~=2.2.0",
        "sqlalchemy[asyncio]~=1.4.25",
        "asyncpg~=0.24.0",
    ],
    entry_points={
        "console_scripts": [
            "openbikesensor-api=obs.bin.openbikesensor_api:main",
        ]
    },
)
