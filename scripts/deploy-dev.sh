#!/usr/bin/env bash
set -euo pipefail

archive=${1:?usage: deploy-dev.sh ARCHIVE}
host=${DEV_SSH_HOST:?DEV_SSH_HOST is required}
user=${DEV_SSH_USER:?DEV_SSH_USER is required}

[[ $GITHUB_SHA =~ ^[0-9a-f]{40}$ ]]
[[ $archive == "bookwise-frontend-${GITHUB_SHA}.tar.gz" ]]
test -s "${archive}.sha256"
sha256sum --check "${archive}.sha256"

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
previous=""
if [[ -L "$base/current" ]]; then
  previous=$(readlink -f "$base/current" || true)
fi

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
if ! curl --fail --silent --show-error --resolve dev.bookwise.cl:443:127.0.0.1 \
  https://dev.bookwise.cl/ >/dev/null; then
  if [[ -n "$previous" && -d "$previous" && "$previous" == "$base"/releases/* ]]; then
    ln -sfn "$previous" "$base/current.rollback"
    mv -Tf "$base/current.rollback" "$base/current"
    echo "Smoke check failed; restored frontend release at $previous" >&2
  else
    echo 'Smoke check failed and no valid previous frontend release was found' >&2
  fi
  exit 1
fi
rm -f "$archive"
REMOTE
