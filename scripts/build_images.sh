#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_dir="$(CDPATH= cd -- "$script_dir/.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  scripts/build_images.sh [--output PATH] [--no-build]

Examples:
  scripts/build_images.sh
  scripts/build_images.sh --output release/my_fastapi_service_images.tar

This script only builds and exports production images. It does not start services.
Copy the generated tar to the server, then run:
  docker load -i <tar>
  scripts/run.sh prod
EOF
}

output=""
build=1

while [ "$#" -gt 0 ]; do
    case "$1" in
        --output)
            output="${2:?missing output path}"
            shift
            ;;
        --no-build)
            build=0
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [ -z "$output" ]; then
    output="release/my_fastapi_service_images.tar"
fi

cd "$repo_dir"

if [ "$build" = "1" ]; then
    docker compose --profile prod build backend-prod frontend-prod
fi

mkdir -p "$(dirname -- "$output")"
docker save -o "$output" \
    my_fastapi_service-backend-prod \
    my_fastapi_service-frontend-prod

cat <<EOF
Image archive created: $output

Server commands:
  docker load -i $output
  scripts/run.sh prod
EOF
