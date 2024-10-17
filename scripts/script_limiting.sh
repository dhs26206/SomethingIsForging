#!/bin/bash

# Check if exactly 3 arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <script_path> <cpu_limit_percentage> <memory_limit_percentage>"
    exit 1
fi

# Arguments
SCRIPT_PATH=$1
CPU_LIMIT=$2
MEMORY_LIMIT=$3

# Check if the script file exists
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Error: Script '$SCRIPT_PATH' does not exist."
    exit 1
fi

# Get the script name (without the directory) to use in alias
SCRIPT_NAME=$(basename "$SCRIPT_PATH")
ALIAS_NAME="${SCRIPT_NAME}ddks"

# Get memory in KB and calculate memory limit in KB
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
MEMORY_LIMIT_KB=$(( TOTAL_MEM_KB * MEMORY_LIMIT / 100 ))

# Create a cgroup for the script
sudo cgcreate -g memory,cpu:/$ALIAS_NAME

# Set CPU and memory limits for the cgroup
sudo cgset -r cpu.cfs_quota_us=$(( CPU_LIMIT * 1000 )) /$ALIAS_NAME
sudo cgset -r memory.limit_in_bytes=$(( MEMORY_LIMIT_KB * 1024 )) /$ALIAS_NAME

# Create alias with the resource limitations
ALIAS_COMMAND="sudo cgexec -g memory,cpu:/$ALIAS_NAME cpulimit --limit=$CPU_LIMIT -- $SCRIPT_PATH"

# Add the alias to .bashrc
echo "alias $ALIAS_NAME=\"$ALIAS_COMMAND\"" >> ~/.bashrc

# Source .bashrc to apply the changes
source ~/.bashrc

echo "Alias '$ALIAS_NAME' created with $CPU_LIMIT% CPU limit and $MEMORY_LIMIT% memory limit."
