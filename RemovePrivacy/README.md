Filters a CSV file as written by the OpenBikeSensor hardware for privacy zones.

Each circle-shaped privacy zone is defined by the latitude and longitude of its center, as well as radius.
The center is further displaced to obscure the true position of the zone center.

Basic usage:

    python filterCSV.py -i input.csv -o output.csv -z privacyzones.txt -s SECRET 

Make sure to replace "SECRET" by a string just known to you.

If you do not want to have your privacy zone centers be displaced (because you already did it), use

    python filterCSV.py -i input.csv -o output.csv -z privacyzones.txt -R 0  

Filtering all files in a directory:

    for file in obsfiles/*.csv; do python filterCSV.py -i "${file}" -z privacyzones.txt -s SECRET -v; done
 
For more options see 
    
    python filterCSV.py -h

Requirements
- python module *haversine*
- A *privacyzones.txt* file with one line for each privacy zone in the following format. The name is optional.  
  49.12345;9.87645;200;Home  
  latitude;longitude;size;name, i.e. radius of privacy zone; name of privacy zone  
  
