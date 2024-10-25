Hey This a Daemon , I used to limit the exploitation of Server by any user.

This Daemon monitors all the process of all users and check whether if any user is excedding 5% CPU or 5% Memory.

I know there are sometimes small spikes , so keeping in mind , This script checks whether it is exploiting it for more than 1 minute.

If User excess for more than 1 Minutes. It kills that process.

But this have a flaw , that I observed after running this Daemon.
>> When I was deploying Frontend Website(Includess npm install and npm build) it got error, becuase Daemon killed that process "lol"

Therefore, Script been modified then to monitor to only process which are in "/etc/user-monitor/allowed.txt"

To make this as Daemon, it recommend you to see the manual.txt in this directory
