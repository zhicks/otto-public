#!/bin/bash

echo Running git add -A, git commit and git push
cd ~
cd otto
git add -A
git commit -m "deployment"
git push
echo Running the command file with secrets
ssh blackbox-client 'bash -s' <<ENDSSH
./otto-start.sh
ENDSSH