#!/bin/bash

# Define the group name
GROUP_NAME="deploy"

# Check if the group exists, if not, create it
if ! grep -q "^$GROUP_NAME:" /etc/group; then
    echo "Group $GROUP_NAME does not exist. Creating the group..."
    groupadd $GROUP_NAME
    echo "Group $GROUP_NAME created."
else
    echo "Group $GROUP_NAME already exists."
fi

# Check if at least one username is provided
if [ "$#" -eq 0 ]; then
    echo "No users specified. Please provide at least one username."
    exit 1
fi

# Loop over all provided usernames and add them to the group
for user in "$@"; do
    if id "$user" &>/dev/null; then
        usermod -aG $GROUP_NAME "$user"
        echo "User $user has been added to the group $GROUP_NAME."
    else
        echo "User $user does not exist. Skipping."
    fi
done

echo "Script completed."
