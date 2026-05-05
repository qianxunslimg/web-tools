#!/bin/sh
set -eu

is_true() {
    case "${1:-}" in
        1|true|TRUE|True|yes|YES|y|Y|on|ON)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

if is_true "${DB_ENABLED:-0}"; then
    echo "DB_ENABLED=${DB_ENABLED} detected; checking database connection."
    python3 tools/check_db_connection.py
else
    echo "DB_ENABLED=${DB_ENABLED:-0} detected; skipping database connection check."
fi

if [ "${ENVIRONMENT:-local}" = "prod" ] && is_true "${DB_ENABLED:-0}"; then
    echo "ENVIRONMENT=${ENVIRONMENT:-local} detected; running aerich upgrade."
    aerich upgrade
else
    echo "ENVIRONMENT=${ENVIRONMENT:-local} detected; skipping aerich upgrade."
fi

if [ "${ENVIRONMENT:-local}" = "prod" ]; then
    exec uvicorn app:app --host 0.0.0.0 --port 8000
fi

exec uvicorn app:app --reload --host 0.0.0.0 --port 8000
