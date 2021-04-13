# Overview
OBS-FACE-Visualization visualizes the output of the [OpenBikeSensor FACE script](https://github.com/openbikesensor/OpenBikeSensor-Scripts/blob/main/docs/obs-face.md) in a map overlay style.    

The visualization is implemented as two static HTMl/JavaScript websites, requiring a simple HTTP server and a recent web browser on client side. 

# Installation
Clone the script repository

 `git clone https://github.com/openbikesensor/OpenBikeSensor-Scripts.git`

and go to the visualization subdirectory

 `cd OpenBikeSensor-Scripts/OBS-FACE-Visualization`.

Create a subdirectory `json` and copy the GeoJson files resulting from running  [OpenBikeSensor FACE script](https://github.com/openbikesensor/OpenBikeSensor-Scripts/blob/main/docs/obs-face.md) (by default `./data/visualization/*.json`) there. 

The directory containing `measurements.html` and `roads.html` must be served using an HTTP server.   
For local, *non-public use*, a simple one - e.g. [SimpleHTTPServer](https://docs.python.org/2/library/simplehttpserver.html#module-SimpleHTTPServer) is sufficient. 

# Visualizations 
Connect to the HTTP server, and open `measurements.html` or `roads.html`.

## Measurement Visualization
Open `measurements.html` to shows all *confirmed* measurements.

## Road Visualization
Open `roads.html` to shows all confirmed measurements consolidates to ways, i.e. road segments, also separated by direction.

# FAQ
1) The maps opens, but no roads/measurements are shown. 
   - Opening the files directly from the file system will fail with modern browsers due to security restrictions.
   - Make sure you places `measurements.json` and `roads.json` in the `./json` subdirectory. 


