#!/usr/bin/bash

ICEusername=$1
ICEpassword=$2
ICEfile="./build/content/js/game/comm.js"

sed -i "1s/.*/const TURNusername=\"$ICEusername\";/" $ICEfile
sed -i "2s/.*/const TURNpassword=\"$ICEpassword\";/" $ICEfile
