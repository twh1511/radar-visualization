#!/bin/bash
set -e

BASE_DIR="{{BASE_DIR}}/{{APP_DIR_NAME}}"
ENV_FILE="$BASE_DIR/config/ds.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

exec "$DS_ENTRY"
