#!/bin/bash

# Check if at least one username is provided
if [ "$#" -eq 0 ]; then
    echo "No users specified. Please provide at least one username."
    exit 1
fi

# List of commands to restrict
RESTRICTED_COMMANDS=(
  "ls"          # List directory contents
  "curl"        # Transfer data from or to a server
  "wget"        # Retrieve files from the web
  "rm"          # Remove files or directories
  "su"          # Switch user
  "sudo"        # Execute a command as another user
  "nano"        # Text editor
  "apt"         # Package manager
  "chmod"       # Change file modes or Access Control Lists
  "chown"       # Change file owner and group
  "ps"          # Report process status
  "kill"        # Send a signal to a process
  "pkill"       # Send signals to processes based on name
  "top"         # Display Linux tasks
  "htop"        # Interactive process viewer
  "df"          # Report file system disk space usage
  "du"          # Estimate file space usage
  "find"        # Search for files in a directory hierarchy
  "grep"        # Print lines matching a pattern
  "sed"         # Stream editor
  "awk"         # Pattern scanning and processing language
  "man"         # Display the manual for a command
  "mkdir"       # Create directories
  "rmdir"       # Remove empty directories
  "touch"       # Change file timestamps or create empty files
  "ping"        # Send ICMP ECHO_REQUEST to network hosts
  "netstat"     # Print network connections, routing tables, interface statistics
  "ifconfig"    # Configure network interfaces (deprecated, use `ip`)
  "ip"          # Show/manipulate routing, devices, policy routing, and tunnels
  "scp"         # Secure copy (remote file copy program)
  "rsync"       # Remote file and directory synchronization
  "ssh"
  "sh"         # OpenSSH SSH client (remote login program)
)
# Iterate over each provided username
for USER in "$@"; do
    # Get the user's home directory
    USER_HOME=$(eval echo "~$USER")

    # Check if the user's home directory exists
    if [ -d "$USER_HOME" ]; then
        # Modify the user's .bashrc file to restrict commands
        echo "Restricting commands for user $USER"

        for CMD in "${RESTRICTED_COMMANDS[@]}"; do
            echo "alias $CMD='echo \"$CMD command is restricted for this user\"'" >> "$USER_HOME/.bashrc"
        done

        echo "Restrictions applied for $USER."
    else
        echo "User $USER does not have a home directory. Skipping."
    fi
done

echo "Restriction script completed."
