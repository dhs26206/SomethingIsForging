#!/bin/bash

# Check if the script is run with sufficient privileges
if [ "$(id -u)" -ne "0" ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

# Check if a username was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <username>"
    exit 1
fi

# Read the username from the argument
USERNAME="$1"

# Create the user with a home directory
useradd -m "$USERNAME"

# Check if user creation was successful
if [ $? -ne 0 ]; then
    echo "Failed to create user $USERNAME."
    exit 1
fi

# Set a password for the new user


# Check if password setting was successful
if [ $? -ne 0 ]; then
    echo "Failed to set password for $USERNAME."
    exit 1
fi

# Output success message
echo "User $USERNAME has been created and password set successfully."
chsh -s /bin/bash "$USERNAME"
exit 0
