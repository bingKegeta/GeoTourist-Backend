#! /bin/bash

podman build -t tourfusion .
podman tag tourfusion:latest "$CREG_URI"/tourfusion:latest
aws ecr get-login-password --region "$AWS_REGION" | podman login --username AWS --password-stdin "$CREG_URI"
podman push "$CREG_URI"/tourfusion:latest
