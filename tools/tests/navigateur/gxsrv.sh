#!/bin/bash
for p in $(ps -eo pid,args | grep "deno run" | grep "gx-server.ts" | grep -v grep | awk '{print $1}'); do kill $p; done
sleep 1
cd /home/claude/sounsouni.github.io/tools/tests
nohup npx deno run --no-check --import-map=import-map.json --allow-env --allow-read --allow-net --no-lock /root/work/gx-server.ts > /root/work/gx-server.log 2>&1 &
for i in $(seq 1 20); do sleep 1; curl -s -o /dev/null localhost:8787/token?id=A && echo prêt && exit 0; done
echo échec; cat /root/work/gx-server.log
