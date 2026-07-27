#!/bin/zsh

set -euo pipefail

launcher_name="Kawan Campus生产管理后台.app"
legacy_launcher_name="Kawan Campus后台直入.app"
script_directory="${0:A:h}"
launcher_source="${script_directory}/kawan-admin-launcher.applescript"
launcher_icon="${script_directory}/kawan-admin-launcher.icns"
desktop_directory="$(/usr/bin/osascript -e 'POSIX path of (path to desktop folder)')"
application_support_directory="$(/usr/bin/osascript -e 'POSIX path of (path to application support folder from user domain)')"
launcher_target="${desktop_directory%/}/${launcher_name}"
legacy_launcher_target="${desktop_directory%/}/${legacy_launcher_name}"
backup_directory="${application_support_directory%/}/Kawan Campus/Launcher Backups"

if [[ ! -f "${launcher_source}" || ! -f "${launcher_icon}" ]]; then
  print -u2 "启动器源文件或图标不完整。"
  exit 1
fi

backup_timestamp="$(/bin/date +%Y%m%d-%H%M%S)"
/bin/mkdir -p "${backup_directory}"

backup_launcher() {
  local existing_launcher="$1"
  local backup_name="$2"

  if [[ -e "${existing_launcher}" ]]; then
    local backup_target="${backup_directory}/${backup_name}-${backup_timestamp}-$$.app"
    /bin/mv "${existing_launcher}" "${backup_target}"
    print "旧启动器已移出桌面并备份：${backup_target}"
  fi
}

backup_launcher "${launcher_target}" "Kawan Campus生产管理后台"
backup_launcher "${legacy_launcher_target}" "Kawan Campus后台直入"

/usr/bin/osacompile -o "${launcher_target}" "${launcher_source}"
/bin/cp "${launcher_icon}" "${launcher_target}/Contents/Resources/applet.icns"

/usr/libexec/PlistBuddy -c "Set :CFBundleName Kawan Campus生产管理后台" \
  "${launcher_target}/Contents/Info.plist"

if ! /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" \
  "${launcher_target}/Contents/Info.plist" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy \
    -c "Add :CFBundleIdentifier string com.laizeyu.kawancampus.production-admin" \
    "${launcher_target}/Contents/Info.plist"
fi

/usr/libexec/PlistBuddy \
  -c "Set :CFBundleIdentifier com.laizeyu.kawancampus.production-admin" \
  "${launcher_target}/Contents/Info.plist"

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

print "Kawan Campus 生产管理后台启动器已安装：${launcher_target}"
