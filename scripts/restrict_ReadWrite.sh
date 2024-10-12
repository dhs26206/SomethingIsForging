#!/bin/bash

for user in "$@"; do
    # Check if the user exists
    if id "$user" &>/dev/null; then
        # Get user's home directory (defaults to /home/username)
        USER_HOME=$(eval echo "~$user")

        # If the home directory doesn't exist, create it
        if [ ! -d "$USER_HOME" ]; then
            echo "Creating home directory for $user at $USER_HOME"
            mkdir -p "$USER_HOME"
        fi

        # Set ownership of the home directory to the user
        echo "Setting ownership for $user's home directory: $USER_HOME"
        chown -R "$user:deploy" "$USER_HOME"

        # Set the user's home directory to be readable/writable by the user only
        echo "Setting permissions for $user's home directory: $USER_HOME"
        chmod 700 "$USER_HOME"  # User has full access, others have no access

        echo "User $user has been restricted to their home directory."
    else
        echo "User $user does not exist. Skipping."
    fi
done

echo "Script completed."
