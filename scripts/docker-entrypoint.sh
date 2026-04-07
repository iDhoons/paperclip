#!/bin/sh
set -e

# Capture runtime UID/GID from environment variables, defaulting to 1000
PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

# Adjust the node user's UID/GID if they differ from the runtime request
# and fix volume ownership only when a remap is needed
changed=0

if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
    changed=1
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
    changed=1
fi

# Always ensure /paperclip is writable by node (volume mounts may have root ownership)
chown -R node:node /paperclip 2>/dev/null || true

# Symlink plugin dir from user home to volume (gosu sets HOME to /home/paperclip)
NODE_HOME=$(getent passwd node | cut -d: -f6)
if [ -n "$NODE_HOME" ] && [ "$NODE_HOME" != "/paperclip" ]; then
    mkdir -p "$NODE_HOME"
    rm -rf "$NODE_HOME/.paperclip" 2>/dev/null || true
    ln -sf /paperclip/.paperclip "$NODE_HOME/.paperclip"
fi

# Clean up old database backups to prevent ENOSPC on ephemeral disk
BACKUP_DIR="/paperclip/.paperclip/instances/default/data/backups"
if [ -d "$BACKUP_DIR" ]; then
    backup_count=$(find "$BACKUP_DIR" -type f | wc -l)
    if [ "$backup_count" -gt 0 ]; then
        echo "Cleaning $backup_count old backup files from $BACKUP_DIR"
        rm -rf "$BACKUP_DIR"/*
    fi
fi

# Pre-install bundled plugins: symlink from workspace into the plugin
# directory so the server discovers them and node can resolve all deps
# through the workspace node_modules.
PLUGIN_DIR="/paperclip/.paperclip/plugins"
mkdir -p "$PLUGIN_DIR/node_modules/@paperclipai"
if [ -d /app/packages/plugins/plugin-discord/dist ]; then
    rm -rf "$PLUGIN_DIR/node_modules/@paperclipai/plugin-discord"
    ln -sf /app/packages/plugins/plugin-discord "$PLUGIN_DIR/node_modules/@paperclipai/plugin-discord"
    echo "Linked plugin-discord into $PLUGIN_DIR"
fi

exec gosu node "$@"
