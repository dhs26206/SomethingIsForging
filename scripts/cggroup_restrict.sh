#!/bin/bash

# CPU and memory limits
CPU_LIMIT="4000"    # 4% of 1 CPU (4000 = 4% in cgroups CPU quota, out of 100000)
MEMORY_LIMIT_PERCENT="5%"  # 5% of the total system memory

# Check if cgcreate and cgset commands are available
if ! command -v cgcreate &> /dev/null || ! command -v cgset &> /dev/null
then
    echo "cgcreate or cgset could not be found. Please install 'cgroup-tools'."
    exit 1
fi

# Calculate the total memory and set the memory limit for each user
TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')  # Total system memory in kB
MEM_LIMIT_BYTES=$((TOTAL_MEM * 1024 * 5 / 100))             # 5% of total memory in bytes

# Iterate over each provided username
for USER in "$@"
do
    # Define the cgroup name for the user
    USER_CGROUP_NAME="user_${USER}"

    # Create a cgroup for the user
    cgcreate -g cpu,memory:/user_groups/$USER_CGROUP_NAME

    # Set the CPU limit (in microseconds per 100000 microseconds) for the user
    cgset -r cpu.cfs_quota_us=$CPU_LIMIT /user_groups/$USER_CGROUP_NAME

    # Set the memory limit (in bytes) for the user
    cgset -r memory.limit_in_bytes=$MEM_LIMIT_BYTES /user_groups/$USER_CGROUP_NAME

    echo "User $USER has been restricted to 4% CPU and 5% memory with cgroup $USER_CGROUP_NAME."
done

echo "CPU and memory limits have been applied to each user."
