Use: for file in obsfiles/*.csv; do ./filter.sh "${file}"; done

Keep in mind:
Diese Art ist sehr umständlich und langsam.
Besser wäre es, das Python-Script so zu schreiben, dass man die privacyzones.txt einmalig einliest und dann jede Zeile auf die Zonen abprüft.

Necessary:
- a *privacyzones.txt* file with one line for each privacy zone in this format
  49.12345;9.87645;200;Home
  lat;long;size, ie radius of privacy zone; name of privacy zone
- python module *haversine*
