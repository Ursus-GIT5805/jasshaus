#!/usr/bin/bash

trap 'kill $(jobs -p)' SIGINT

make serv &
make cont
