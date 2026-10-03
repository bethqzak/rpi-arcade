#!/bin/sh
# Wait (up to 30s) for a display to be detected before the arcade starts.
#
# An HDMI screen can come up a few seconds after boot. Starting before it
# is detected fails immediately, and a fast failure loop trips systemd's
# start-rate limit, which leaves the service dead until someone restarts
# it by hand. Used as ExecStartPre= by the kiosk unit.
#
# WAIT_TRIES and DRM_STATUS override the defaults (for tests).
tries="${WAIT_TRIES:-60}"
i=0
while [ "$i" -lt "$tries" ]; do
    # shellcheck disable=SC2086  # the glob must expand
    grep -qs '^connected' ${DRM_STATUS:-/sys/class/drm/card*-*/status} && exit 0
    i=$((i + 1))
    sleep 0.5
done
echo "wait-for-display: no connected display after $((tries / 2))s, starting anyway" >&2
exit 0
