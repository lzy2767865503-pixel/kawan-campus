#!/bin/zsh

set -euo pipefail

launcher_name="Kawan Campus后台直入.app"
script_directory="${0:A:h}"
launcher_source="${script_directory}/kawan-admin-launcher.applescript"
launcher_icon="${script_directory}/kawan-admin-launcher.icns"
desktop_directory="$(/usr/bin/osascript -e 'POSIX path of (path to desktop folder)')"
launcher_target="${desktop_directory%/}/${launcher_name}"

if [[ ! -f "${launcher_source}" || ! -f "${launcher_icon}" ]]; then
  print -u2 "启动器源文件或图标不完整。"
  exit 1
fi

if [[ -e "${launcher_target}" ]]; then
  backup_timestamp="$(/bin/date +%Y%m%d-%H%M%S)"
  backup_target="${desktop_directory%/}/Kawan Campus后台直入-${backup_timestamp}.app"
  /bin/mv "${launcher_target}" "${backup_target}"
  print "旧启动器已备份：${backup_target}"
fi

/usr/bin/osacompile -o "${launcher_target}" "${launcher_source}"
/bin/cp "${launcher_icon}" "${launcher_target}/Contents/Resources/applet.icns"

/usr/libexec/PlistBuddy -c "Set :CFBundleName Kawan Campus后台直入" \
  "${launcher_target}/Contents/Info.plist"

if ! /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" \
  "${launcher_target}/Contents/Info.plist" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy \
    -c "Add :CFBundleIdentifier string com.laizeyu.kawancampus.admin-launcher" \
    "${launcher_target}/Contents/Info.plist"
fi

privacy_description_keys=(
  NSAppleEventsUsageDescription
  NSAppleMusicUsageDescription
  NSCalendarsUsageDescription
  NSCameraUsageDescription
  NSContactsUsageDescription
  NSHomeKitUsageDescription
  NSMicrophoneUsageDescription
  NSPhotoLibraryUsageDescription
  NSRemindersUsageDescription
  NSSiriUsageDescription
  NSSystemAdministrationUsageDescription
)

for privacy_key in "${privacy_description_keys[@]}"; do
  /usr/libexec/PlistBuddy -c "Delete :${privacy_key}" \
    "${launcher_target}/Contents/Info.plist" >/dev/null 2>&1 || true
done

if ! /usr/libexec/PlistBuddy -c "Print :LSUIElement" \
  "${launcher_target}/Contents/Info.plist" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" \
    "${launcher_target}/Contents/Info.plist"
fi

/usr/bin/codesign --force --deep --sign - "${launcher_target}" >/dev/null
/usr/bin/touch "${launcher_target}"

print "Kawan Campus 后台启动器已安装：${launcher_target}"
