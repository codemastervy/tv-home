#!/bin/sh
# No ads: the home may only reference an allowlist of hosts, and none may be an ad/tracker network.
# Fails on any host not on the list, so a new one has to be reviewed on purpose.
cd "$(dirname "$0")/.." || exit 2
ALLOW='tvos.invalid|images.justwatch.com|sdk.scdn.co|github.com|api.github.com|geocoding-api.open-meteo.com|api.open-meteo.com|api-partner.spotify.com|example.com'
ADS='doubleclick|googlesyndication|adservice|admob|applovin|unity3d.com/ads|adcolony|taboola|outbrain|samba|ads\.|adsrvr|scorecardresearch|tvping|alphonso|ravm|inscape'
HOSTS=$(grep -rhoE 'https?://[A-Za-z0-9._-]+' tv-home/web/*.js tv-home/web/index.html tv-home/web/app.css \
  tv-home/android/app/src/main/java | sed -E 's#https?://##' | sort -u)
bad=0
for h in $HOSTS; do
  echo "$h" | grep -q -E "^($ALLOW)$" || { echo "UNLISTED HOST: $h"; bad=1; }
  echo "$h" | grep -q -i -E "$ADS" && { echo "AD/TRACKER HOST: $h"; bad=1; }
done
[ "$bad" = 0 ] && echo "No ads: ok ($(echo "$HOSTS" | wc -l | tr -d ' ') hosts, all allowlisted)"
exit $bad
