#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  scripts/run.sh dev [--build|--no-build] [--foreground] [--down|--logs] [-- extra compose args]
  scripts/run.sh prod [--build|--no-build] [--foreground] [--down|--logs] [-- extra compose args]

Examples:
  scripts/run.sh dev --build
  scripts/run.sh prod
  scripts/run.sh prod --build
  scripts/run.sh prod --logs
  scripts/run.sh prod --down

Defaults:
  dev  -> docker compose up -d --build backend frontend
  prod -> docker compose --profile prod up -d --no-build backend-prod frontend-prod
EOF
}

mode="${1:-dev}"
case "$mode" in
    dev|prod)
        shift || true
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    *)
        echo "Unknown mode: $mode" >&2
        usage >&2
        exit 2
        ;;
esac

action="up"
detach=1
if [[ "$mode" == "prod" ]]; then
    build_arg="--no-build"
    services=(backend-prod frontend-prod)
else
    build_arg="--build"
    services=(backend frontend)
fi

extra_args=()
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --build)
            build_arg="--build"
            ;;
        --no-build)
            build_arg="--no-build"
            ;;
        --foreground)
            detach=0
            ;;
        --down)
            action="down"
            ;;
        --logs)
            action="logs"
            ;;
        --)
            shift
            while [[ "$#" -gt 0 ]]; do
                extra_args+=("$1")
                shift
            done
            break
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            extra_args+=("$1")
            ;;
    esac
    shift || true
done

cd "$REPO_DIR"

compose() {
    if [[ "$mode" == "prod" ]]; then
        docker compose --profile prod "$@"
    else
        docker compose "$@"
    fi
}

case "$action" in
    up)
        up_args=(up "$build_arg")
        if [[ "$detach" == "1" ]]; then
            up_args+=(-d)
        fi
        compose "${up_args[@]}" "${extra_args[@]}" "${services[@]}"
        ;;
    down)
        compose down "${extra_args[@]}"
        ;;
    logs)
        compose logs -f "${extra_args[@]}" "${services[@]}"
        ;;
esac
