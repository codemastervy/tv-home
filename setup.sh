#!/bin/sh
# Runs the interactive setup (needs python3).
cd "$(dirname "$0")" && exec python3 setup.py "$@"
