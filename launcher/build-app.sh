#!/bin/zsh
# Makes "KTSpeedRun.app" on the Desktop: double-click it to start the table (see
# start-table.sh), with the logo as its icon. Run it again if the repo moves.
#   zsh launcher/build-app.sh

set -e
REPO="${0:A:h:h}"
APP="${1:-$HOME/Desktop/KTSpeedRun.app}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# The app opens a Terminal window running the start script, so the server's log shows
# and closing the window stops the table.
cat > "$APP/Contents/MacOS/KillTeamTable" <<EOF
#!/bin/zsh
osascript -e 'tell application "Terminal"' \\
  -e 'activate' \\
  -e 'do script "exec zsh \\"$REPO/launcher/start-table.sh\\""' \\
  -e 'end tell' >/dev/null
EOF
chmod +x "$APP/Contents/MacOS/KillTeamTable" "$REPO/launcher/start-table.sh"

cat > "$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>KTSpeedRun</string>
  <key>CFBundleDisplayName</key><string>KTSpeedRun</string>
  <key>CFBundleIdentifier</key><string>com.ktspeedrun.table</string>
  <key>CFBundleExecutable</key><string>KillTeamTable</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
</dict>
</plist>
EOF

# The icon: a square cut tight around the logo's emblem (only the tips of the wings and
# speed streaks are trimmed), so it fills the icon, at every size macOS asks for.
LOGO="$REPO/public/killteamSpeedrunLogo.png"
sips -c 960 960 --cropOffset 7 274 "$LOGO" --out "$WORK/square.png" >/dev/null 2>&1
mkdir "$WORK/AppIcon.iconset"
for size in 16 32 128 256 512; do
  sips -z $size $size "$WORK/square.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$WORK/square.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$WORK/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
# macOS 26 puts app icons that aren't its rounded-square shape on a grey plate. A
# custom Finder icon isn't, so the logo also goes on as one, transparent around the
# emblem. Setting it also refreshes Finder's cached icon.
osascript -l JavaScript - "$WORK/square.png" "$APP" >/dev/null <<'JS'
ObjC.import('AppKit')
function run([image, app]) {
  return $.NSWorkspace.sharedWorkspace.setIconForFileOptions($.NSImage.alloc.initWithContentsOfFile(image), app, 0)
}
JS

echo "Made $APP"
