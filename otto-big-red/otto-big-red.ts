import {OttoObjectStatus} from "../otto-shared/constants";
import {OttoGroup, OttoTimeSettings} from "../otto-shared/otto-interfaces";

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
    const SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? '': 'http://localhost:3500';
    console.log('socket address is ', SOCKET_ADDRESS);

    // ------------------------------------------------------------------- Props
    let cloudSocket: any;
    let hubClient: any;
    let bridgeIp = null;

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
        })
            .catch(error => {
                console.log('hue jay error getLightObjectDatas');
                console.log(error);
            })
    }

    let setLightsBrightness = (lightIds: string[], brightness: number) => {
        console.log('seting lights brightness', lightIds, brightness);
        hubClient.lights.getAll().then(lights => {
            let matchingHueJayLights = [];
            console.log('hue lights:');
            // console.log(lights);
            for (let hueJayLight of lights) {
                for (let lightId of lightIds) {
                    let uniqueid = hueJayLight.attributes.attributes.uniqueid;
                    if (uniqueid === lightId) {
                        matchingHueJayLights.push(hueJayLight);
                    }
                }
            }
            console.log('matching hue jay lights');
            // console.log(matchingHueJayLights);
            if (matchingHueJayLights.length) {
                for (let light of matchingHueJayLights) {
                    console.log('brightness change: ', brightness);
                    light.brightness = Math.round(254 * brightness);
                    console.log('light brightnes is ', light.brightness);
                    hubClient.lights.save(light);
                }
            }
        })
            .catch(error => {
                console.log('hue jay error setLightsBrightness');
                console.log(error);
            });
    }

    let toggleLights = (lightIds: {lights: string[]}, on: boolean, callback: () => void) => {
        console.log(lightIds);
        // TODO - Refactor this with the above method
        hubClient.lights.getAll().then(lights => {
            let matchingHueJayLights = [];
            console.log('hue lights:');
            // console.log(lights);
            for (let hueJayLight of lights) {
                for (let lightId of lightIds.lights) {
                    let uniqueid = hueJayLight.attributes.attributes.uniqueid;
                    if (uniqueid === lightId) {
                        matchingHueJayLights.push(hueJayLight);
                    }
                }
            }
            console.log('matching hue jay lights');
            // console.log(matchingHueJayLights);
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
        })
            .catch(error => {
                console.log('hue jay error toggleLights');
                console.log(error);
            });
    }

    // ------------------------------------------------------------------- Regular Init (after hub init)
    let initSocket = () => {

        cloudSocket = socketIoClient(SOCKET_ADDRESS);
        cloudSocket.on('connect', () => {
            console.log('connection');
            cloudSocket.emit('lightsSocket', {
                id: 'lightsSocket'
            });
        });

        cloudSocket.on('scan_lights', () => {
            console.log('Scan lights. For now, this just gets lights we already know about. Use hubClient.scan() then getNew() later');
            getLightObjectDatas((lightObjs) => {
                console.log(lightObjs);
                cloudSocket.emit('lightsSocket_lights', lightObjs);
            });
        });

        cloudSocket.on('get_bulb_statuses', () => {
            console.log('calling get bulb statuses');
            getLightObjectDatas((lightObjs) => {
                // console.log(lightObjs);
                lightObjs = lightObjs.map(lightObj => {
                    let status = lightObj.on ? OttoObjectStatus.On : OttoObjectStatus.Off;
                    return { id: lightObj.id, status: status }
                });
                cloudSocket.emit('lightsSocket_bulb_statuses', lightObjs);
            });
        });

        cloudSocket.on('turn_lights_on', (lightObj: {lights: string[], timeSettings: { [hourTime: string]: OttoTimeSettings }}) => {
            console.log('turn lights on for ids');
            toggleLights(lightObj, true, () => {
                cloudSocket.emit('refresh_status');
            });
            if (lightObj.timeSettings) {
                let hours: string[] = Object.keys(lightObj.timeSettings).sort((a, b) => {
                    if (+a > +b) {
                        return 1;
                    } else {
                        return -1;
                    }
                });
                let currentObj: OttoTimeSettings = lightObj.timeSettings[hours[hours.length-1]];
                let currentHour = new Date().getHours();
                hours.forEach(hourString => {
                    if (currentHour >= +hourString) {
                        currentObj = lightObj.timeSettings[hourString];
                    }
                });
                if (currentObj.brightness) {
                    setLightsBrightness(lightObj.lights, currentObj.brightness);
                }
            }
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
            port:     80,
            username: '', // Optional
            timeout:  15000,
        });
        initSocket();
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
                        console.log('hue jay error doHubInit');
                        console.log(error);
                });
        }
    }

    // ------------------------------------------------------------------- Hub One Time Init
    let doHubOneTimeInit = () => {
        let user = new hubClient.users.User;

        // Optionally configure a device type / agent on the user
        user.deviceType = 'bigred'; // Default is 'huejay'

        hubClient.users.create(user)
            .then(user => {
                console.log(`New user created - Username: ${user.username}`);
            })
            .catch(error => {
                if (error instanceof huejay.Error && error.type === 101) {
                    return console.log(`Link button not pressed. Try again...`);
                }

                console.log(error.stack);
            });
    }

    let doScanAndAddNewLights = () => {
        console.log('calling do scan and add new lights');
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
                        })
                        .catch(error => {
                            console.log('hue jay error doScanAndAddNewLights inner');
                            console.log(error);
                        });
                }, 20 * 1000);
            })
            .catch(error => {
                console.log('hue jay error doScanAndAddNewLights');
                console.log(error);
            });
    }

    app.set('view engine', 'html');
    app.set('port', (process.env.PORT || 3501));
    http.listen(app.get('port'), () => {
        console.log('listening on ' + app.get('port'));
    });
    console.log('big red server started');
    doHubInit();
    // doHubOneTimeInit();

}











