import {OttoObjectStatus} from "../otto-shared/constants";

declare const require;
declare const __dirname;
declare const process;

module OttoBigRed {
    let path = require('path');
    let express = require('express');
    let app = express();
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');
    let huejay = require('huejay');

    console.log(process.argv);

    // ------------------------------------------------------------------- Constants
    const SOCKET_ADDRESS = process.argv && process.argv[2] === 'prod' ? 'http://blackboxjs.com:3500': 'http://localhost:3500';
    console.log('socket address is ', SOCKET_ADDRESS);

    // ------------------------------------------------------------------- Props
    let cloudSocket: any;
    let hubClient: any;
    let bridgeIp = '192.168.1.111';

    // ------------------------------------------------------------------- Stuff
    let getLightObjectDatas = (callback) => {
        // Doesnt return otto-specific or huejay-specific
        hubClient.lights.getAll().then(lights => {
            let lightObjs = [];
            for (let light of lights) {
                let id = light.attributes.attributes.uniqueid;
                let type = light.attributes.attributes.type;
                let on = light.state.attributes.on;
                let reachable = light.state.attributes.reachable;
                let bri = light.state.attributes.bri;
                let hue = light.state.attributes.hue;
                let sat = light.state.attributes.sat;
                lightObjs.push({ id, type, on, reachable, bri, hue, sat });
            }
            callback(lightObjs);
        });
    }

    let toggleLights = (lightIds: {lights: string[]}, on: boolean, callback: () => void) => {
        console.log(lightIds);
        hubClient.lights.getAll().then(lights => {
            let matchingHueJayLights = [];
            console.log('hue lights:');
            console.log(lights);
            for (let hueJayLight of lights) {
                for (let lightId of lightIds.lights) {
                    let uniqueid = hueJayLight.attributes.attributes.uniqueid;
                    if (uniqueid === lightId) {
                        matchingHueJayLights.push(hueJayLight);
                    }
                }
            }
            console.log('matching hue jay lights');
            console.log(matchingHueJayLights);
            if (matchingHueJayLights.length) {
                for (let light of matchingHueJayLights) {
                    console.log('turning light on: ', on);
                    light.on = on;
                    hubClient.lights.save(light);
                }
            }
            setTimeout(() => {
                callback();
            }, 100);
        });
    }

    // ------------------------------------------------------------------- Regular Init (after hub init)
    let initSocket = () => {

        cloudSocket = socketIoClient(SOCKET_ADDRESS);
        cloudSocket.on('connect', () => {
            console.log('connection');
            cloudSocket.emit('bigred', {
                id: 'bigred'
            });
        });

        cloudSocket.on('scan_lights', () => {
            console.log('Scan lights. For now, this just gets lights we already know about. Use hubClient.scan() then getNew() later');
            getLightObjectDatas((lightObjs) => {
                console.log(lightObjs);
                cloudSocket.emit('bigred_lights', lightObjs);
            });
        });

        cloudSocket.on('get_bulb_statuses', () => {
            console.log('calling get bulb statuses');
            getLightObjectDatas((lightObjs) => {
                console.log(lightObjs);
                lightObjs = lightObjs.map(lightObj => {
                    let status = lightObj.on ? OttoObjectStatus.On : OttoObjectStatus.Off;
                    return { id: lightObj.id, status: status }
                });
                console.log(lightObjs);
                cloudSocket.emit('bigred_bulb_statuses', lightObjs);
            });
        });

        cloudSocket.on('turn_lights_on', (lightIds: {lights: string[]}) => {
            console.log('turn lights on for ids');
            toggleLights(lightIds, true, () => {
                cloudSocket.emit('refresh_status');
            });
        });

        cloudSocket.on('turn_lights_off', (lightIds: {lights: string[]}) => {
            console.log('turn lights off for ids');
            toggleLights(lightIds, false, () => {
                cloudSocket.emit('refresh_status');
            });
        });

    }

    // ------------------------------------------------------------------- Hub Init
    let doHubInit2 = () => {
        hubClient = new huejay.Client({
            host:     bridgeIp,
            port:     80,               // Optional
            username: '8HeFfV3mq5GswiNZ1ZUcKhi9Nd9Y-Xg33xnoxobW', // Optional
            timeout:  15000,            // Optional, timeout in milliseconds (15000 is the default)
        });
        initSocket();
        // doScanAndAddNewLights();
        // 830F26
    }
    let doHubInit = () => {
        if (bridgeIp) {
            console.log('going with bridge ip that was preset - make sure to remove this if youre not developing right now');
            doHubInit2();
        } else {
            huejay.discover()
                .then(bridges => {
                    if (bridges && bridges.length) {
                        console.log('found bridge ');
                        bridgeIp = bridges[0].ip;
                        console.log(bridgeIp);
                        doHubInit2();
                    } else {
                        console.log('did not find bridge!');
                    }
                })
                .catch(error => {
                    console.log(`An error occurred: ${error.message}`);
                });
        }
    }

    // ------------------------------------------------------------------- Hub One Time Init
    let doHubOneTimeInit = () => {
        console.log('doing one time hub init. this is for creating a user if there is not one. you gotta press the hub link button');
        console.log('actually you may just wanna use the app to add it by serial number');
        let user = new hubClient.users.User;

        // Optionally configure a device type / agent on the user
        user.deviceType = 'bigred'; // Default is 'huejay'

        hubClient.users.create(user)
            .then(user => {
                console.log(`New user created - Username: ${user.username}`);
                console.log('now restart and dont call this method - just call regular init or whatever its called');
                // hubClient.users.get()
                //     .then(user => {
                //         console.log('Username:', user.username);
                //         console.log('Device type:', user.deviceType);
                //         console.log('Create date:', user.created);
                //         console.log('Last use date:', user.lastUsed);
                //     });

                // hubClient.lights.scan()
                //     .then(() => {
                //         console.log('Started new light scan');
                //     });
            })
            .catch(error => {
                if (error instanceof huejay.Error && error.type === 101) {
                    return console.log(`Link button not pressed. Try again...`);
                }

                console.log(error.stack);
            });
    }

    let doScanAndAddNewLights = () => {
        console.log('calling do scan and add new lights - this is a one time thing when you add new bulbs and is manually called');
        hubClient.lights.scan()
            .then(() => {
                console.log('Started new light scan');
                setTimeout(() => {
                    hubClient.lights.getNew()
                        .then(lights => {
                            console.log('Found new lights:');
                            for (let light of lights) {
                                console.log(`Light [${light.id}]:`);
                                console.log('  Unique Id:', light.uniqueId);
                                console.log('  Model:',     light.model.name);
                                console.log('  Reachable:', light.reachable);
                            }
                        });
                }, 20 * 1000);
            });
    }

    app.set('view engine', 'html');
    app.set('port', (process.env.PORT || 3501));
    http.listen(app.get('port'), () => {
        console.log('listening on ' + app.get('port'));
    });
    console.log('big red server started');
    doHubInit();

}











