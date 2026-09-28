#!/usr/bin/env bash
set -euo pipefail
# TLS is enabled on the disposable CI service, not relaxed in application code.
: "${CI:?}" "${PG_CONTAINER_ID:?}" "${RUNNER_TEMP:?}"
[[ "$CI" == "true" ]] || exit 1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -keyout "$RUNNER_TEMP/e2e-server.key" -out "$RUNNER_TEMP/e2e-server.crt" 2>/dev/null
docker cp "$RUNNER_TEMP/e2e-server.key" "$PG_CONTAINER_ID:/tmp/e2e-server.key"
docker cp "$RUNNER_TEMP/e2e-server.crt" "$PG_CONTAINER_ID:/tmp/e2e-server.crt"
docker exec --user root "$PG_CONTAINER_ID" chown postgres:postgres /tmp/e2e-server.key /tmp/e2e-server.crt
docker exec --user root "$PG_CONTAINER_ID" chmod 600 /tmp/e2e-server.key
for setting in "ssl_cert_file = '/tmp/e2e-server.crt'" "ssl_key_file = '/tmp/e2e-server.key'" "ssl = 'on'"; do
  docker exec --user postgres "$PG_CONTAINER_ID" psql -U postgres -d prayer_e2e -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET $setting;"
done
docker exec --user postgres "$PG_CONTAINER_ID" psql -U postgres -d prayer_e2e -v ON_ERROR_STOP=1 -c 'SELECT pg_reload_conf();'
