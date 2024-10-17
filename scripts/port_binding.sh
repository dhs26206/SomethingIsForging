#!/bin/bash

# Check if exactly 2 arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <username> <port>"
    exit 1
fi

# Get the user and allowed port from arguments
USER=$1
ALLOWED_PORT=$2

# Check if the user exists on the system
if ! id "$USER" &>/dev/null; then
    echo "Error: User '$USER' does not exist."
    exit 1
fi

# Get the user's UID
USER_UID=$(id -u "$USER")

# Clear any existing rules for the user (optional)
iptables -D OUTPUT -m owner --uid-owner $USER_UID -j DROP 2>/dev/null
iptables -D OUTPUT -m owner --uid-owner $USER_UID -p tcp --sport $ALLOWED_PORT -j ACCEPT 2>/dev/null

# Allow the user to bind to the allowed port
iptables -A OUTPUT -m owner --uid-owner $USER_UID -p tcp --sport $ALLOWED_PORT -j ACCEPT

# Drop all other port binding attempts by the user
iptables -A OUTPUT -m owner --uid-owner $USER_UID -j DROP

echo "Restricted $USER to only use port $ALLOWED_PORT"
