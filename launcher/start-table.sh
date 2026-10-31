#!/bin/zsh
# Starts the table for game night: builds the app, runs the table server on port 3000
# with the Mac kept awake, and opens the projector page full screen on the projector.
# Run by the desktop icon (see build-app.sh) in a Terminal window; close the window or
# press Ctrl+C to stop everything.

REPO="${0:A:h:h}"
PORT=3000
URL="http://localhost:$PORT"
# A separate Chrome profile, so kiosk mode works while normal Chrome is open.
CHROME_PROFILE="$HOME/Library/Application Support/KillTeamTable/chrome"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

alert() {
  osascript -e "display alert \"Kill Team table\" message \"$1\" as critical" >/dev/null
}

cd "$REPO" || { alert "Can't find the app's folder: $REPO"; exit 1; }

# Apps started from Finder don't load ~/.zshrc, where nvm puts Node on the PATH.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
if ! command -v npm >/dev/null; then
  alert "Node isn't installed or nvm couldn't load it, so the table can't start."
  exit 1
fi

# Where the projector page goes: the first screen that isn't the main one or an
# AirPlay/Sidecar iPad. To pick another, put part of its name (as printed below) in
# launcher/projector-screen.local.
WANTED=""
[ -f "$REPO/launcher/projector-screen.local" ] && WANTED="$(head -n 1 "$REPO/launcher/projector-screen.local")"
projector_origin() {
  WANTED="$WANTED" osascript -l JavaScript <<'JS'
ObjC.import('AppKit')
ObjC.import('stdlib')
const wanted = $.getenv('WANTED') ? ObjC.unwrap($.getenv('WANTED')).toLowerCase() : ''
const screens = $.NSScreen.screens
const main = screens.objectAtIndex(0).frame
const list = []
for (let i = 0; i < screens.count; i++) {
  const screen = screens.objectAtIndex(i)
  list.push({ index: i, name: ObjC.unwrap(screen.localizedName), frame: screen.frame })
}
const pick =
  (wanted && list.find((screen) => screen.name.toLowerCase().includes(wanted))) ||
  list.find((screen) => screen.index > 0 && !/airplay|sidecar/i.test(screen.name)) ||
  list[0];
// macOS counts y up from the main screen's bottom; Chrome counts down from its top.
const fromTop = main.size.height - (pick.frame.origin.y + pick.frame.size.height);
`${pick.frame.origin.x},${fromTop} ${pick.name}`
JS
}

open_projector() {
  local found origin
  found="$(projector_origin)"
  origin="${found%% *}"
  echo "Projector page on: ${found#* }"
  mkdir -p "$CHROME_PROFILE"
  if [ -x "$CHROME" ]; then
    "$CHROME" --user-data-dir="$CHROME_PROFILE" --no-first-run --no-default-browser-check \
      --window-position="$origin" --kiosk --app="$URL/table" >/dev/null 2>&1 &!
  else
    open "$URL/table"
  fi
}

# Already running? Just open the page again. The dev server (npm run dev) also uses
# port 3000 but doesn't serve the app, so it has to be stopped first.
if curl -sf "$URL/api/info" >/dev/null; then
  if curl -sf -o /dev/null "$URL/table"; then
    echo "The table is already running."
    open_projector
    exit 0
  fi
  alert "The dev server is running (from VS Code). Stop it first, then open the table again."
  exit 1
fi

# Open the projector page once the server answers (the build takes a little while).
(
  for _ in {1..180}; do
    if curl -sf "$URL/api/info" >/dev/null; then
      open_projector
      exit 0
    fi
    sleep 1
  done
) &
WAITER=$!
trap 'kill $WAITER 2>/dev/null' EXIT

mkdir -p server/data
echo "Starting the Kill Team table. Close this window or press Ctrl+C to stop it."
echo "--- $(date) ---" >> server/data/table.log
# caffeinate keeps the Mac (and its Wi-Fi) awake for as long as the server runs.
caffeinate -dimsu npm run table 2>&1 | tee -a server/data/table.log
