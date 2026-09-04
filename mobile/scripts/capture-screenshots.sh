#!/usr/bin/env bash
# boots a headless android emulator, installs an apk, opens every screen by deep
# link and saves one png per screen. this is how docs/screenshots is produced,
# so reviewers can see the app without running an emulator themselves.
#
# usage: scripts/capture-screenshots.sh path/to/app-release.apk [out-dir]
# needs: ANDROID_HOME (defaults to /opt/android-sdk) with an avd named "$AVD" (default sz).
set -euo pipefail

APK=${1:?usage: capture-screenshots.sh app.apk [out-dir]}
OUT=${2:-docs/screenshots}
AVD=${AVD:-sz}
SDK=${ANDROID_HOME:-/opt/android-sdk}
ADB="$SDK/platform-tools/adb"
PKG=zone.syrian.app
SETTLE=${SETTLE:-6}

# screen name, deep link. order matches the website navbar.
SCREENS=(
  "home syrianzone://"
  "settings syrianzone://settings"
  "syofficial syrianzone://feature/syofficial"
  "roznama syrianzone://feature/roznama"
  "phonebook syrianzone://feature/phonebook"
  "warnings syrianzone://feature/warnings"
  "syid syrianzone://feature/syid"
  "tierlist syrianzone://feature/tierlist"
  "contributors syrianzone://feature/contributors"
  "sites syrianzone://feature/sites"
  "population syrianzone://feature/population"
  "party syrianzone://feature/party"
  "house syrianzone://feature/house"
  "compass syrianzone://feature/compass"
  "priorities syrianzone://feature/priorities"
  "govapps syrianzone://feature/govapps"
  "transit syrianzone://transit"
  "shawarma syrianzone://feature/shawarma"
  "justice syrianzone://feature/justice"
  "places syrianzone://feature/places"
  "board syrianzone://board"
  "polls syrianzone://feature/polls"
  "about syrianzone://about"
)

mkdir -p "$OUT"

if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "booting $AVD"
  "$SDK/emulator/emulator" -avd "$AVD" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect \
    -no-snapshot -memory 3072 -cores 4 >/tmp/sz-emulator.log 2>&1 &
  EMULATOR_PID=$!
  trap 'kill $EMULATOR_PID 2>/dev/null || true' EXIT
  "$ADB" wait-for-device
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
fi

# boot_completed fires before the package service accepts installs; a 200 MB apk
# streamed too early dies with "Broken pipe", so wait for pm and retry the install.
until "$ADB" shell pm path android >/dev/null 2>&1; do sleep 3; done

# the software-rendered emulator trips "System UI isn't responding" under load; hide error dialogs
"$ADB" shell settings put global hide_error_dialogs 1
"$ADB" shell settings put global window_animation_scale 0
"$ADB" shell settings put global transition_animation_scale 0
"$ADB" shell settings put global animator_duration_scale 0
for attempt in 1 2 3; do
  "$ADB" install -r "$APK" && break
  echo "install attempt $attempt failed, retrying"
  sleep 10
done

# the software-rendered system ui still trips "isn't responding" dialogs, which also eat taps;
# press its "wait" row whenever the window manager shows one
dismiss_anr() {
  if "$ADB" shell dumpsys window windows 2>/dev/null | grep -q "Not Responding"; then
    "$ADB" shell input tap 320 1363
    sleep 2
  fi
}

open_link() {
  "$ADB" shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" >/dev/null
}

shoot() {
  local name=$1 link=$2
  open_link "$link"
  sleep "$SETTLE"
  dismiss_anr
  "$ADB" exec-out screencap -p > "$OUT/$name.png"
  echo "wrote $OUT/$name.png"
}

# first launch: the unblock syria notice pops after 2s, dismiss it once so it does not cover every shot
"$ADB" shell cmd uimode night no
"$ADB" shell am force-stop "$PKG"
open_link "syrianzone://"
sleep 10
dismiss_anr
"$ADB" exec-out screencap -p > "$OUT/home-first-launch.png"
# "لاحقا" (later) sits bottom center of the notice on a 1080x2400 screen
"$ADB" shell input tap 528 2250 || true
sleep 2

for entry in "${SCREENS[@]}"; do
  shoot ${entry}
done

# the sidebar and theme sheet need a tap: hamburger and palette buttons in the header (1080x2400)
open_link "syrianzone://feature/syofficial"
sleep "$SETTLE"
dismiss_anr
"$ADB" shell input tap 1000 211
sleep 3
dismiss_anr
"$ADB" exec-out screencap -p > "$OUT/sidebar.png"
"$ADB" shell input keyevent KEYCODE_BACK
sleep 2
dismiss_anr
"$ADB" shell input tap 192 211
sleep 3
dismiss_anr
"$ADB" exec-out screencap -p > "$OUT/theme-picker.png"
"$ADB" shell input keyevent KEYCODE_BACK
sleep 1

# dark mode follows the system when the theme preference is "system"
"$ADB" shell cmd uimode night yes
sleep 2
shoot home-dark "syrianzone://"
shoot tierlist-dark "syrianzone://feature/tierlist"
"$ADB" shell cmd uimode night no

echo "done: $(ls "$OUT" | wc -l) files in $OUT"
