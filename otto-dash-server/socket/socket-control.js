"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../../otto-shared/constants");
var db_service_1 = require("../data/db-service");
var uuidv4 = require('uuid/v4');
var socketIo = require('socket.io');
var SocketControl = /** @class */ (function () {
    function SocketControl() {
        this.satellites = [];
        this.appSockets = [];
    }
    SocketControl.prototype.init = function (http) {
        var _this = this;
        var io = socketIo(http);
        io.on('connection', function (socket) {
            console.log('connection');
            socket.on('bigred', function () {
                console.log('big red connected');
                _this.bigRed = socket;
                _this.bigRed.bigRed = true;
            });
            socket.on('bigred_lights', function (lightObjs) {
                // These have plenty of info on them but for now we only care about a little bit
                console.log('got big red lights, calling update or insert if necessary');
                db_service_1.dbService.insertLightsFromBigRedIfNecessary(lightObjs);
            });
            socket.on('bigred_bulb_statuses', function (lights) {
                // We send it piecemeal
                var status = {
                    groups: []
                };
                for (var _i = 0, lights_1 = lights; _i < lights_1.length; _i++) {
                    var light = lights_1[_i];
                    var group = _this.findGroupForLightId(light.id);
                    if (!group) {
                        console.log('could not find group for light id ', light.id);
                    }
                    else {
                        var foundGroup = void 0;
                        for (var _a = 0, _b = status.groups; _a < _b.length; _a++) {
                            var g = _b[_a];
                            if (g.id === group.id) {
                                foundGroup = g;
                                break;
                            }
                        }
                        if (!foundGroup) {
                            foundGroup = {
                                id: group.id,
                                lights: []
                            };
                            status.groups.push(foundGroup);
                        }
                        foundGroup.lights.push(light);
                    }
                }
                for (var _c = 0, _d = _this.appSockets; _c < _d.length; _c++) {
                    var appSocket = _d[_c];
                    appSocket.emit('status', status);
                }
            });
            socket.on('satellite', function (idObj) {
                console.log('satellite connected with id', idObj.id);
                _this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                socket.emit('info', {
                    timeout: 30 * 60 * 1000
                });
            });
            socket.on('satellite_motion_status', function (obj) {
                // We send it piecemeal
                var group = _this.findGroupForSatelliteId(obj.id);
                for (var _i = 0, _a = _this.appSockets; _i < _a.length; _i++) {
                    var appSocket = _a[_i];
                    appSocket.emit('status', {
                        groups: [{
                                id: group.id,
                                motion: {
                                    status: obj.status
                                }
                            }]
                    });
                }
            });
            socket.on('app_get_status', function () {
                console.log('app get status was called');
                if (!socket.appId) {
                    socket.appId = uuidv4();
                    _this.appSockets.push(socket);
                }
                // get bulb statuses
                // then get satellite statuses
                if (_this.bigRed) {
                    _this.bigRed.emit('get_bulb_statuses');
                }
                for (var _i = 0, _a = _this.satellites; _i < _a.length; _i++) {
                    var sat = _a[_i];
                    sat.emit('get_motion_status');
                }
            });
            socket.on('app_update_program', function () {
                _this.updateProgram();
            });
            socket.on('app_motion_on', function (groupObj) {
                var satSocket = _this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_on');
            });
            socket.on('app_motion_off', function (groupObj) {
                var satSocket = _this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_off');
            });
            socket.on('app_motion_on_temp', function (groupObj) {
                var satSocket = _this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_off_temp');
            });
            socket.on('app_group_lights_on', function (groupObj) {
                // send to big red
                var lights = db_service_1.dbService.getLightsForGroupId(groupObj.group);
                var lightIds = lights.map(function (light) { return light.id; });
                if (_this.bigRed) {
                    _this.bigRed.emit('turn_lights_on', {
                        lights: lightIds
                    });
                }
            });
            socket.on('app_group_lights_off', function (groupObj) {
                var lights = db_service_1.dbService.getLightsForGroupId(groupObj.group);
                var lightIds = lights.map(function (light) { return light.id; });
                if (_this.bigRed) {
                    _this.bigRed.emit('turn_lights_off', {
                        lights: lightIds
                    });
                }
            });
            socket.on('app_scan_lights', function () {
                if (_this.bigRed) {
                    _this.bigRed.emit('scan_lights');
                }
            });
            socket.on('satellite_motion_detected', function (idObj) {
                var group = _this.findGroupForSatelliteId(idObj.id);
                var lights = db_service_1.dbService.getLightsForGroupId(group.id);
                var lightIds = lights.map(function (light) { return light.id; });
                _this.bigRed.emit('turn_lights_on', {
                    lights: lightIds
                });
            });
            socket.on('satellite_motion_timeout', function (idObj) {
                var group = _this.findGroupForSatelliteId(idObj.id);
                var lights = db_service_1.dbService.getLightsForGroupId(group.id);
                var lightIds = lights.map(function (light) { return light.id; });
                _this.bigRed.emit('turn_lights_off', {
                    lights: lightIds
                });
            });
            socket.on('disconnect', function () {
                console.log('socket disconnect');
                if (socket.bigRed) {
                    _this.bigRed = null;
                    console.log('big red disconnect');
                }
                if (socket.satellite) {
                    console.log('socket is satellite', socket.satelliteId);
                    for (var i = 0; i < _this.satellites.length; i++) {
                        var sat = _this.satellites[i];
                        if (sat.satelliteId === socket.satelliteId) {
                            _this.satellites.splice(i, 1);
                            console.log('satellite removed');
                            break;
                        }
                    }
                }
                if (socket.appId) {
                    console.log('socket is app', socket.appId);
                    for (var i = 0; i < _this.appSockets.length; i++) {
                        var app = _this.appSockets[i];
                        if (app.appId === socket.appId) {
                            _this.appSockets.splice(i, 1);
                            console.log('app socket removed');
                            break;
                        }
                    }
                }
                console.log('satellites:');
                console.log(_this.satellites);
                console.log('apps:');
                console.log(_this.appSockets);
            });
        });
    };
    SocketControl.prototype.updateProgram = function () {
        for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
            var satellite = _a[_i];
            satellite.emit('update_program');
        }
    };
    SocketControl.prototype.findSatSocketForGroupId = function (groupId) {
        // For now these actions just grab whatever satellite there is
        var group = db_service_1.dbService.findItemById(groupId, constants_1.OttoItemType.Group);
        if (!group) {
            console.log('no group found for ', groupId);
        }
        else {
            var sat = db_service_1.dbService.findSatelliteForGroup(group.id);
            if (!sat) {
                console.log('no sat found for group id ', group.id);
                var satSocket = void 0;
                for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
                    var socket = _a[_i];
                    if (socket.id === sat.id) {
                        return socket;
                    }
                }
            }
        }
    };
    SocketControl.prototype.findGroupForSatelliteId = function (satId) {
        var sat = db_service_1.dbService.findItemById(satId, constants_1.OttoItemType.Satellite);
        return db_service_1.dbService.findItemById(sat.group, constants_1.OttoItemType.Group);
    };
    SocketControl.prototype.findGroupForLightId = function (lightId) {
        console.log('find gruop for light id ', lightId);
        var light = db_service_1.dbService.findItemById(lightId, constants_1.OttoItemType.Light);
        if (!light) {
            console.log('coudl not find light');
            return null;
        }
        return db_service_1.dbService.findItemById(light.group, constants_1.OttoItemType.Group);
    };
    return SocketControl;
}());
exports.socketControl = new SocketControl();
