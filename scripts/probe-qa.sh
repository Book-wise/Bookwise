#!/usr/bin/env bash
# Sonda de inspección del servidor QA de Bookwise — ESTRICTAMENTE SOLO LECTURA.
# No escribe, no reinicia servicios, no toca base de datos, no lee credenciales.
# Uso:  bash probe-qa.sh [usuario]   (por defecto: root)
set -uo pipefail

HOST="161.35.227.63"
USER="${1:-root}"
KEY="$HOME/.ssh/bookwise_platform"
OUT="${OUT:-/tmp/bookwise-qa-inspection-$(date -u +%Y%m%dT%H%M%SZ).txt}"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 \
    "${USER}@${HOST}" 'bash -s' <<'REMOTE' 2>&1 | tee "$OUT"
set -uo pipefail
s(){ printf '\n===== %s =====\n' "$1"; }

s "IDENTIDAD Y HOST"
id; hostname; uptime; cat /etc/os-release 2>/dev/null | head -3

s "RECURSOS"
free -m; df -h / /srv 2>/dev/null; nproc
echo "--- eventos OOM recientes ---"
grep -ci 'out of memory' /var/log/syslog 2>/dev/null || echo "sin acceso a syslog"

s "LAYOUT /srv/bookwise"
ls -la /srv/bookwise 2>/dev/null
echo "--- current apunta a ---"
readlink -f /srv/bookwise/current 2>/dev/null || echo "current no es symlink"
echo "--- contenido de current ---"
ls -la /srv/bookwise/current/ 2>/dev/null
echo "--- releases/ shared/ backups/ ---"
for d in releases shared backups; do
  echo "[$d]"; ls -la "/srv/bookwise/$d" 2>/dev/null || echo "  no existe"
done
echo "--- frontend publicado ---"
ls -la /srv/bookwise/current/frontend/ 2>/dev/null | head -15

s "PROPIEDAD Y PERMISOS"
stat -c '%n  owner=%U:%G  mode=%a' /srv/bookwise /srv/bookwise/current 2>/dev/null
stat -c '%n  owner=%U:%G  mode=%a' /srv/bookwise/current/frontend 2>/dev/null

s "USUARIOS DE DESPLIEGUE"
getent passwd | awk -F: '$3>=1000 && $3<65534 {print $1"  uid="$3"  shell="$7"  home="$6}'
echo "--- claves autorizadas (solo conteo y comentarios, sin exponer claves) ---"
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -r "$f" ] && echo "$f: $(grep -c . "$f" 2>/dev/null) claves -> $(awk '{print $NF}' "$f" 2>/dev/null | tr '\n' ' ')"
done

s "NGINX"
nginx -v 2>&1
echo "--- vhosts habilitados ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
echo "--- root/server_name/proxy_pass efectivos ---"
grep -rhnE '^\s*(root|server_name|listen|proxy_pass|try_files|alias)' \
  /etc/nginx/sites-enabled/ 2>/dev/null | head -40
echo "--- test de configuracion (no recarga) ---"
nginx -t 2>&1

s "PHP-FPM"
php -v 2>&1 | head -2
systemctl is-active php8.3-fpm 2>/dev/null
ls /etc/php/*/fpm/pool.d/ 2>/dev/null
grep -hE '^\s*(user|group|listen)\s*=' /etc/php/*/fpm/pool.d/*.conf 2>/dev/null | head

s "SERVICIOS"
systemctl is-active nginx mysql php8.3-fpm 2>/dev/null
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -25

s "MYSQL (metadatos, sin credenciales)"
mysql --version 2>&1
ss -lntp 2>/dev/null | grep -E '3306|:80|:443|:22' || netstat -lntp 2>/dev/null | grep -E '3306|:80|:443|:22'

s "TOOLCHAIN DISPONIBLE PARA BUILD/DEPLOY"
for c in node npm git rsync composer certbot tar gzip jq; do
  printf '%-9s %s\n' "$c" "$(command -v $c >/dev/null && $c --version 2>&1 | head -1 || echo 'NO INSTALADO')"
done

s "FIREWALL"
ufw status verbose 2>/dev/null || iptables -S 2>/dev/null | head -20

s "BACKEND LARAVEL (solo metadatos, .env NO se muestra)"
ls -la /srv/bookwise/current/backend/ 2>/dev/null | head -20
echo "--- APP_ENV / APP_DEBUG / APP_URL (claves sensibles omitidas) ---"
grep -E '^(APP_ENV|APP_DEBUG|APP_URL|SESSION_SECURE_COOKIE|DB_CONNECTION|DB_HOST|DB_DATABASE|MAIL_MAILER)=' \
  /srv/bookwise/current/backend/.env 2>/dev/null || echo "sin acceso o no existe"
echo "--- storage symlink / permisos ---"
ls -la /srv/bookwise/current/backend/storage 2>/dev/null | head -5

s "CRON / TIMERS (backups existentes?)"
crontab -l 2>/dev/null | grep -v '^#' | head
ls -la /etc/cron.d/ 2>/dev/null | head
systemctl list-timers --no-pager 2>/dev/null | head -10

s "LOGS: rutas y tamanos"
ls -la /var/log/nginx/ 2>/dev/null | head
du -sh /var/log 2>/dev/null

s "SMOKE TEST LOCAL (solo GET)"
curl -s -o /dev/null -w 'index: http=%{http_code} tiempo=%{time_total}s\n' http://127.0.0.1/ 2>&1
curl -s -o /dev/null -w '/up:   http=%{http_code}\n' http://127.0.0.1/up 2>&1
curl -s -o /dev/null -w '/api/v1: http=%{http_code}\n' http://127.0.0.1/api/v1 2>&1

s "FIN"
REMOTE

echo
echo "Salida guardada en: $OUT"
