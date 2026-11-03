#!/usr/bin/env bash
set -euo pipefail

archive=${1:?usage: deploy-dev.sh ARCHIVE}
host=${DEV_SSH_HOST:?DEV_SSH_HOST is required}
user=${DEV_SSH_USER:?DEV_SSH_USER is required}

[[ $GITHUB_SHA =~ ^[0-9a-f]{40}$ ]]
[[ $archive == "bookwise-frontend-${GITHUB_SHA}.tar.gz" ]]

release="$(date -u +%Y%m%dT%H%M%SZ)-${GITHUB_SHA:0:12}"
checksum=$(sha256sum "$archive" | awk '{print $1}')
remote_archive="/srv/bookwise/development/incoming/${archive}"

scp "$archive" "${user}@${host}:${remote_archive}"
ssh "${user}@${host}" bash -s -- "$release" "$remote_archive" "$checksum" <<'REMOTE'
set -euo pipefail
release=$1
archive=$2
checksum=$3
base=/srv/bookwise/development/frontend

[[ $release =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]]
[[ $archive =~ ^/srv/bookwise/development/incoming/bookwise-frontend-[0-9a-f]{40}\.tar\.gz$ ]]
[[ $checksum =~ ^[0-9a-f]{64}$ ]]
[[ $(sha256sum "$archive" | awk '{print $1}') == "$checksum" ]]

target="$base/releases/$release"
test ! -e "$target"
install -d -m 755 "$target"
tar -xzf "$archive" -C "$target"
test -s "$target/index.html"
ln -sfn "$target" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
curl --fail --silent --show-error --resolve dev.bookwise.cl:443:127.0.0.1 \
  https://dev.bookwise.cl/ >/dev/null
rm -f "$archive"
REMOTE
