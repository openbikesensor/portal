Filters a CSV file as written by the OpenBikeSensor hardware for privacy zones.

Each circle-shaped privacy zone is defined by the latitude and longitude of its center, as well as radius.
The center is further displaced to obscure the true position.

Basic usage:

    python filterCSV.py -i input.csv -o output.csv -z privacyzones.txt -s SECRET 

Filtering all files in a directory:

    for file in obsfiles/*.csv; do python filterCSV.py -i "${file}" -z privacyzones.txt -s SECRET -v; done

Make sure to replace "SECRET" by a string just known to you.
 
For more options see 
    
    python filterCSV.py -h

Requirements
- python module *haversine*
- A *privacyzones.txt* file with one line for each privacy zone in the following format. The name is needed, though not important. It will only be used in the output of the script:  
  49.12345;9.87645;200  
  lat;long;size, ie radius of privacy zone; name of privacy zone  
  
