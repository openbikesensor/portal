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
        "sanic~=21.9.1",
        "oic>=1.3.0, <2",
        "sanic-session~=0.8.0",
        "sanicargs~=2.1.0",
        "sanic-cors~=1.0.1",
        "python-slugify~=5.0.2",
        "motor~=2.5.1",
        "sqlparse~=0.4.2",
        "openmaptiles-tools",  # install from git
        "pyshp~=2.1.3",
    ],
    entry_points={
        "console_scripts": [
            "openbikesensor-api=obs.bin.openbikesensor_api:main",
        ]
    },
)
