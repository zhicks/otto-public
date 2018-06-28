"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../otto-shared/constants");
var OttoBigRed;
(function (OttoBigRed) {
    var path = require('path');
    var express = require('express');
    var app = express();
    var http = require('http').Server(app);
    var socketIoClient = require('socket.io-client');
    var huejay = require('huejay');
    console.log(process.argv);
    // ------------------------------------------------------------------- Constants
    var SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? 'http://blackboxjs.com:3500' : 'http://localhost:3500';
    console.log('socket address is ', SOCKET_ADDRESS);
    // ------------------------------------------------------------------- Props
    var cloudSocket;
    var hubClient;
    // let bridgeIp = '192.168.1.100';
    var bridgeIp = null;
    // ------------------------------------------------------------------- Stuff
    var getLightObjectDatas = function (callback) {
        // Doesnt return otto-specific or huejay-specific
        hubClient.lights.getAll().then(function (lights) {
            var lightObjs = [];
            for (var _i = 0, lights_1 = lights; _i < lights_1.length; _i++) {
                var light = lights_1[_i];
                var id = light.attributes.attributes.uniqueid;
                var type = light.attributes.attributes.type;
                var on = light.state.attributes.on;
                var reachable = light.state.attributes.reachable;
                var bri = light.state.attributes.bri;
                var hue = light.state.attributes.hue;
                var sat = light.state.attributes.sat;
                lightObjs.push({ id: id, type: type, on: on, reachable: reachable, bri: bri, hue: hue, sat: sat });
            }
            callback(lightObjs);
        })
            .catch(function (error) {
            console.log('hue jay error getLightObjectDatas');
            console.log(error);
        });
    };
    var setLightsBrightness = function (lightIds, brightness) {
        console.log('seting lights brightness', lightIds, brightness);
        hubClient.lights.getAll().then(function (lights) {
            var matchingHueJayLights = [];
            console.log('hue lights:');
            // console.log(lights);
            for (var _i = 0, lights_2 = lights; _i < lights_2.length; _i++) {
                var hueJayLight = lights_2[_i];
                for (var _a = 0, lightIds_1 = lightIds; _a < lightIds_1.length; _a++) {
                    var lightId = lightIds_1[_a];
                    var uniqueid = hueJayLight.attributes.attributes.uniqueid;
                    if (uniqueid === lightId) {
                        matchingHueJayLights.push(hueJayLight);
                    }
                }
            }
            console.log('matching hue jay lights');
            // console.log(matchingHueJayLights);
            if (matchingHueJayLights.length) {
                for (var _b = 0, matchingHueJayLights_1 = matchingHueJayLights; _b < matchingHueJayLights_1.length; _b++) {
                    var light = matchingHueJayLights_1[_b];
                    console.log('brightness change: ', brightness);
                    light.brightness = Math.round(254 * brightness);
                    console.log('light brightnes is ', light.brightness);
                    hubClient.lights.save(light);
                }
            }
        })
            .catch(function (error) {
            console.log('hue jay error setLightsBrightness');
            console.log(error);
        });
    };
    var toggleLights = function (lightIds, on, callback) {
        console.log(lightIds);
        // TODO - Right above is the same code
        hubClient.lights.getAll().then(function (lights) {
            var matchingHueJayLights = [];
            console.log('hue lights:');
            // console.log(lights);
            for (var _i = 0, lights_3 = lights; _i < lights_3.length; _i++) {
                var hueJayLight = lights_3[_i];
                for (var _a = 0, _b = lightIds.lights; _a < _b.length; _a++) {
                    var lightId = _b[_a];
                    var uniqueid = hueJayLight.attributes.attributes.uniqueid;
                    if (uniqueid === lightId) {
                        matchingHueJayLights.push(hueJayLight);
                    }
                }
            }
            console.log('matching hue jay lights');
            // console.log(matchingHueJayLights);
            if (matchingHueJayLights.length) {
                for (var _c = 0, matchingHueJayLights_2 = matchingHueJayLights; _c < matchingHueJayLights_2.length; _c++) {
                    var light = matchingHueJayLights_2[_c];
                    console.log('turning light on: ', on);
                    light.on = on;
                    hubClient.lights.save(light);
                }
            }
            setTimeout(function () {
                callback();
            }, 100);
        })
            .catch(function (error) {
            console.log('hue jay error toggleLights');
            console.log(error);
        });
    };
    // ------------------------------------------------------------------- Regular Init (after hub init)
    var initSocket = function () {
        cloudSocket = socketIoClient(SOCKET_ADDRESS);
        cloudSocket.on('connect', function () {
            console.log('connection');
            cloudSocket.emit('bigred', {
                id: 'bigred'
            });
        });
        cloudSocket.on('scan_lights', function () {
            console.log('Scan lights. For now, this just gets lights we already know about. Use hubClient.scan() then getNew() later');
            getLightObjectDatas(function (lightObjs) {
                console.log(lightObjs);
                cloudSocket.emit('bigred_lights', lightObjs);
            });
        });
        cloudSocket.on('get_bulb_statuses', function () {
            console.log('calling get bulb statuses');
            getLightObjectDatas(function (lightObjs) {
                // console.log(lightObjs);
                lightObjs = lightObjs.map(function (lightObj) {
                    var status = lightObj.on ? constants_1.OttoObjectStatus.On : constants_1.OttoObjectStatus.Off;
                    return { id: lightObj.id, status: status };
                });
                cloudSocket.emit('bigred_bulb_statuses', lightObjs);
            });
        });
        cloudSocket.on('turn_lights_on', function (lightObj) {
            console.log('turn lights on for ids');
            toggleLights(lightObj, true, function () {
                cloudSocket.emit('refresh_status');
            });
            if (lightObj.timeSettings) {
                var hours = Object.keys(lightObj.timeSettings).sort(function (a, b) {
                    if (+a > +b) {
                        return 1;
                    }
                    else {
                        return -1;
                    }
                });
                var currentObj_1 = lightObj.timeSettings[hours[hours.length - 1]];
                var currentHour_1 = new Date().getHours();
                hours.forEach(function (hourString) {
                    if (currentHour_1 >= +hourString) {
                        currentObj_1 = lightObj.timeSettings[hourString];
                    }
                });
                // -------------------------------------------------------------------
                // const diningRoomLightId = '00:17:88:01:03:44:bd:8f-0b';
                // if (lightObj.lights.indexOf(diningRoomLightId) !== -1) {
                //     lightObj.lights.splice(lightObj.lights.indexOf(diningRoomLightId), 1);
                // }
                // -------------------------------------------------------------------
                if (currentObj_1.brightness) {
                    setLightsBrightness(lightObj.lights, currentObj_1.brightness);
                }
            }
        });
        cloudSocket.on('turn_lights_off', function (lightIds) {
            console.log('turn lights off for ids');
            toggleLights(lightIds, false, function () {
                cloudSocket.emit('refresh_status');
            });
        });
    };
    // ------------------------------------------------------------------- Hub Init
    var doHubInit2 = function () {
        hubClient = new huejay.Client({
            host: bridgeIp,
            port: 80,
            username: '8HeFfV3mq5GswiNZ1ZUcKhi9Nd9Y-Xg33xnoxobW',
            timeout: 15000,
        });
        initSocket();
        // doScanAndAddNewLights();
    };
    var doHubInit = function () {
        if (bridgeIp) {
            console.log('going with bridge ip that was preset - make sure to remove this if youre not developing right now');
            doHubInit2();
        }
        else {
            huejay.discover()
                .then(function (bridges) {
                if (bridges && bridges.length) {
                    console.log('found bridge ');
                    bridgeIp = bridges[0].ip;
                    console.log(bridgeIp);
                    doHubInit2();
                }
                else {
                    console.log('did not find bridge!');
                }
            })
                .catch(function (error) {
                console.log('hue jay error doHubInit');
                console.log(error);
            });
        }
    };
    // ------------------------------------------------------------------- Hub One Time Init
    var doHubOneTimeInit = function () {
        console.log('doing one time hub init. this is for creating a user if there is not one. you gotta press the hub link button');
        console.log('actually you may just wanna use the app to add it by serial number');
        var user = new hubClient.users.User;
        // Optionally configure a device type / agent on the user
        user.deviceType = 'bigred'; // Default is 'huejay'
        hubClient.users.create(user)
            .then(function (user) {
            console.log("New user created - Username: " + user.username);
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
            .catch(function (error) {
            if (error instanceof huejay.Error && error.type === 101) {
                return console.log("Link button not pressed. Try again...");
            }
            console.log(error.stack);
        });
    };
    var doScanAndAddNewLights = function () {
        console.log('calling do scan and add new lights - this is a one time thing when you add new bulbs and is manually called');
        hubClient.lights.scan()
            .then(function () {
            console.log('Started new light scan');
            setTimeout(function () {
                hubClient.lights.getNew()
                    .then(function (lights) {
                    console.log('Found new lights:');
                    for (var _i = 0, lights_4 = lights; _i < lights_4.length; _i++) {
                        var light = lights_4[_i];
                        console.log("Light [" + light.id + "]:");
                        console.log('  Unique Id:', light.uniqueId);
                        console.log('  Model:', light.model.name);
                        console.log('  Reachable:', light.reachable);
                    }
                })
                    .catch(function (error) {
                    console.log('hue jay error doScanAndAddNewLights inner');
                    console.log(error);
                });
            }, 20 * 1000);
        })
            .catch(function (error) {
            console.log('hue jay error doScanAndAddNewLights');
            console.log(error);
        });
    };
    app.set('view engine', 'html');
    app.set('port', (process.env.PORT || 3501));
    http.listen(app.get('port'), function () {
        console.log('listening on ' + app.get('port'));
    });
    console.log('big red server started');
    doHubInit();
})(OttoBigRed || (OttoBigRed = {}));
