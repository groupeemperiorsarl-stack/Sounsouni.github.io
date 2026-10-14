#!/bin/bash
cd "$(dirname "$0")"
declare -A ROT=( [bags]="-70,0,0" [tie]="-8,0,-16" [shoe]="-78,155,0" [corset]="-80,0,0" [duck]="-80,220,0" [watch]="-90,0,0" )
for k in bags tie shoe corset duck watch perfume phone laptop fridge solar sofa pot avocado water plant tools car ball babybottle pencils djembe pills ebook gradcap apps headphones docs gift tshirt; do
  [ -f hqB/$k.png ] && continue
  SNS_V=B timeout 900 /home/claude/blend/bin/python medal.py $k $PWD/hqB/$k.png 640 128 ${ROT[$k]} > hqB/$k.log 2>&1 && echo "ok $k" || echo "ECHEC $k"
done
echo FINI
