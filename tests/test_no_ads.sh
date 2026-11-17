#!/bin/sh
# No ads: the home may only reference an allowlist of hosts, and none may be an ad/tracker network.
# api.themoviedb.org and image.tmdb.org are allowed only because TMDB is optional: it must be off in
# config.example.json and every request in sources.js must sit behind tmdbActive() (tests/test_logic.js
# also checks that a disabled TMDB makes no request at all).
cd "$(dirname "$0")/.." || exit 2
ALLOW='tvos.invalid|github.com|api.github.com|geocoding-api.open-meteo.com|api.open-meteo.com|example.com|www.w3.org'
TMDB='api.themoviedb.org|image.tmdb.org'
ADS='doubleclick|googlesyndication|adservice|admob|applovin|unity3d.com/ads|adcolony|taboola|outbrain|samba|ads\.|adsrvr|scorecardresearch|tvping|alphonso|ravm|inscape'
HOSTS=$(grep -rhoE 'https?://[A-Za-z0-9._-]+' tv-home/web/*.js tv-home/web/index.html tv-home/web/home.css \
  tv-home/android/app/src/main/java | sed -E 's#https?://##' | sort -u)
bad=0
tmdb_ok=0
python3 -c "import json,sys; c=json.load(open('config.example.json')); sys.exit(0 if c.get('tmdb',{}).get('enabled') is False else 1)" \
  && grep -q 'tmdbActive' tv-home/web/sources.js && tmdb_ok=1
for h in $HOSTS; do
  if echo "$h" | grep -q -E "^($TMDB)$"; then
    [ "$tmdb_ok" = 1 ] || { echo "TMDB HOST WITHOUT AN OFF-BY-DEFAULT TMDB SWITCH: $h"; bad=1; }
  else
    echo "$h" | grep -q -E "^($ALLOW)$" || { echo "UNLISTED HOST: $h"; bad=1; }
  fi
  echo "$h" | grep -q -i -E "$ADS" && { echo "AD/TRACKER HOST: $h"; bad=1; }
done
[ "$bad" = 0 ] && echo "No ads: ok ($(echo "$HOSTS" | wc -l | tr -d ' ') hosts, TMDB only when enabled)"
exit $bad
