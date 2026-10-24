#!/bin/sh
[ -d /opt/jboss ] && export KCBASE=/opt/jboss/keycloak || export KCBASE=/opt/keycloak
# Login
$KCBASE/bin/kcadm.sh config credentials --server http://localhost:8080/ --realm master --user $KC_BOOTSTRAP_ADMIN_USERNAME --password $KC_BOOTSTRAP_ADMIN_PASSWORD

# Create Realm
$KCBASE/bin/kcadm.sh create realms -s realm=$OBS_KEYCLOAK_REALM -s enabled=true -o >/dev/null

# Create a client and remember the unique id of the client
CID=$($KCBASE/bin/kcadm.sh create clients -r $OBS_KEYCLOAK_REALM -s clientId=portal -s "redirectUris=[\"$OBS_KEYCLOAK_PORTAL_REDIRECT_URI\"]" -i) >/dev/null

# Create a secret for the client
$KCBASE/bin/kcadm.sh create clients/$CID/client-secret -r $OBS_KEYCLOAK_REALM >/dev/null

# Get the secret of the client
$KCBASE/bin/kcadm.sh get clients/$CID/client-secret -r $OBS_KEYCLOAK_REALM | grep value | tr -s '[:space:]'| cut -d' ' -f4-
#!/bin/sh

if [[ "$OBS_KEYCLOAK_REALM" == "obs-dev" ]]
then
$KCBASE/bin/kcadm.sh create users -r obs-dev -s username=obs  -s enabled=true -s firstName=OBS -s lastName=Tester -s email='tom+tester@localhost' >/dev/null
$KCBASE/bin/kcadm.sh set-password -r obs-dev --username obs --new-password obs >/dev/null
fi
