# OpenBikeSensor Scripts Collection

This repository contains scripts and utilities for working with OpenBikeSensor
data.  This is mostly for processing the data for visualization, but also other
tangential use cases.

## Installation

The scripts in this repository are python based. You will need a up to date
python installation (Python 3.8 or above). We recommend the use of a [virtual
environment](https://docs.python.org/3/tutorial/venv.html) to keep dependencies
and the installation of this package self-contained. You can of course install
everything into your system as well, but that is not recommended in the
standard use case.

Run the following commands to set up a (development) version of this package.
This means that editing the source code, or updating it using git, will
automatically refer to the new version when calling the command line scripts.

```
pip install -e .
```

If you update the source code and some imports to libraries do not work, simply
re-running the above command should install them. For a non-development
installation, omit the `-e`. Other pip options can be used as normal.

## Usage

The following scripts are provided. Please refer to the respective
documentation files for details on how to use them.

* **[obs-face](./docs/obs-face.md)**, a toolset for filtering, annotating,
  consolidating and exporting OpenBikeSensor measurements
* **[obs-filter-privacy](./docs/obs-filter-privacy.md)**, a small utility for
  anonymization of a CSV file that removes measurments that are inside privacy
  zones
  
  
## License
  
    Copyright (C) 2020-2021 OpenBikeSensor Contributors
    Contact: https://openbikesensor.org
    
    The OpenBikeSensor Scripts Collection is free software: you can redistribute it
    and/or modify it under the terms of the GNU Lesser General Public License
    as published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.
    
    The OpenBikeSensor Scripts Collection is distributed in the hope that it will be
    useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
    General Public License for more details.
    
    You should have received a copy of the GNU Lesser General Public License
    along with the OpenBikeSensor Scripts Collection. If not, see
    <http://www.gnu.org/licenses/>.

See also [`COPYING`](./COPYING) and [`COPYING.LESSER`](./COPYING.LESSER).
