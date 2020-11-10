#!/bin/bash

### Use: for file in obsfiles/*.csv; do ./filter.sh "${file}"; done

RANDOM_OFFSET=15
PRIVACY_ZONES_LIST="/home/me/projects/openbikesensor/privacyzones/privacyzones.txt"
FILTERCSV_PY_BIN="/home/me/projects/openbikesensor/privacyzones/filterCSV.py"

FILENAME="${1}"
FILENAME_BASENAME=$(basename -s .csv "${FILENAME}")
DIRNAME=$(dirname "${FILENAME}")
DEST_FILENAME="${DIRNAME}/${FILENAME_BASENAME} cleaned.csv"

TMPFILE_A=$(mktemp -q)
TMPFILE_B=$(mktemp -q)
cp "${FILENAME}" "${TMPFILE_A}"

while read zone;
do
    PR_LAT=$(echo ${zone} | cut  -d';' -f 1)
    PR_LON=$(echo ${zone} | cut  -d';' -f 2)
    PR_RADIUS=$(echo ${zone} | cut  -d';' -f 3)
    PR_DESCRIPTION=$(echo ${zone} | cut  -d';' -f 4)
    
    echo -en "\n\n${PR_DESCRIPTION}:\n  Latitude: ${PR_LAT}\n  Longitute: ${PR_LON}\n  Radius: ${PR_RADIUS}
    Write to file: \"${DEST_FILENAME}\""
  
    # Read tmpfile_a, remove ONE privacy zone and write result to tmpfile_b. Then cp tmpfile_b to tmpfile_a and repeat with next privacy zone.
    "${FILTERCSV_PY_BIN}" -i "${TMPFILE_A}" -o "${TMPFILE_B}" --lat "${PR_LAT}" --lon "${PR_LON}" --radius "${PR_RADIUS}" --randofs="${RANDOM_OFFSET}"
    
    cp "${TMPFILE_B}" "${TMPFILE_A}"
done < "${PRIVACY_ZONES_LIST}"

cp "${TMPFILE_A}" "${DEST_FILENAME}"

rm "${TMPFILE_A}"
rm "${TMPFILE_B}"
