
FROM codercom/code-server:latest

USER root

ENV DEBIAN_FRONTEND=noninteractive

# Install system utilities and Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create the workspace directory
RUN mkdir -p /home/coder/project \
    && chown -R coder:coder /home/coder/project

WORKDIR /home/coder/project

USER coder

EXPOSE 8080

CMD ["--auth", "none", "--bind-addr", "0.0.0.0:8080", "/home/coder/project"]
