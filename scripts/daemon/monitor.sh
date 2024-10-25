#!/bin/bash

# Thresholds
CPU_LIMIT=5
MEMORY_LIMIT=5
CHECK_INTERVAL=5    # Check every 5 seconds
THRESHOLD_DURATION=60   # 1 minute in seconds

# File containing allowed users
ALLOWED_USERS_FILE="/etc/user-monitor/allowed.txt"

# Declare associative arrays to store timestamps
declare -A cpu_exceeded_time
declare -A mem_exceeded_time

# Function to check if a user is allowed
is_user_allowed() {
    local user=$1
    grep -Fxq "$user" "$ALLOWED_USERS_FILE"
}

while true; do
    # Get list of users with processes
    for user in $(ps -eo user --no-headers | sort | uniq); do
        # Skip the root user
        if [[ "$user" == "root" ]]; then
            continue
        fi

        # Skip users not in the allowed.txt file
        if ! is_user_allowed "$user"; then
            continue
        fi

        # Get total CPU and memory usage for the user
        user_cpu=$(ps -u $user -o %cpu --no-headers | awk '{sum+=$1} END {print sum}')
        user_mem=$(ps -u $user -o %mem --no-headers | awk '{sum+=$1} END {print sum}')

        # Get current time in seconds since epoch
        current_time=$(date +%s)

        # Check CPU usage
        if (( $(echo "$user_cpu > $CPU_LIMIT" | bc -l) )); then
            if [[ -z ${cpu_exceeded_time[$user]} ]]; then
                cpu_exceeded_time[$user]=$current_time
            elif (( $((current_time - cpu_exceeded_time[$user])) >= $THRESHOLD_DURATION )); then
                echo "Killing all processes for user: $user (CPU: $user_cpu%)"
                pkill -u $user
                unset cpu_exceeded_time[$user]
            fi
        else
            unset cpu_exceeded_time[$user]
        fi

        # Check memory usage
        if (( $(echo "$user_mem > $MEMORY_LIMIT" | bc -l) )); then
            if [[ -z ${mem_exceeded_time[$user]} ]]; then
                mem_exceeded_time[$user]=$current_time
            elif (( $((current_time - mem_exceeded_time[$user])) >= $THRESHOLD_DURATION )); then
                echo "Killing all processes for user: $user (MEM: $user_mem%)"
                pkill -u $user
                unset mem_exceeded_time[$user]
            fi
        else
            unset mem_exceeded_time[$user]
        fi
    done

    # Sleep before checking again
    sleep $CHECK_INTERVAL
done
