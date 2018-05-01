#!/bin/bash

# To be run on the client machine
# Note that if you modify this, you should run this command twice

cd ~
cd otto
echo Doing git stash in otto
git stash
echo Doing git pull in otto
git pull
cd otto-dash-server
echo Doing npm install in otto-dash-server
npm install
echo Doing npm run tsc in otto-dash-server
npm run tsc
cd ../otto-dash-client
echo Doing npm install in otto-dash-client
npm install
echo Running npm run build in client
npm run build
echo Calling pm2 restart all --update-env
pm2 restart all --update-env
echo Deployment process done