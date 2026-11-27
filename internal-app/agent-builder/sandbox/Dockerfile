FROM node:22-bookworm-slim

ENV CI=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    python3 \
    tini \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.33.2 --activate \
  && git config --system --add safe.directory /workspace

WORKDIR /workspace
ENTRYPOINT ["tini", "--"]
CMD ["sleep", "infinity"]
