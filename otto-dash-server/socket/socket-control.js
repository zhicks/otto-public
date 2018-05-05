"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../../otto-shared/constants");
var db_service_1 = require("../data/db-service");
var uuidv4 = require('uuid/v4');
var socketIo = require('socket.io');
var OttoLogger = /** @class */ (function () {
    function OttoLogger(id, type, logToConsole) {
        this.id = id;
        this.type = type;
        this.logToConsole = logToConsole;
        this.limit = 40;
        this.messages = [];
    }
    OttoLogger.prototype.log = function (message) {
        var messageObj = {
            ts: new Date(),
            ms: message,
            id: this.id,
            type: this.type
        };
        this.messages.unshift(messageObj);
        if (this.messages.length > this.limit) {
            this.messages.pop();
        }
        if (this.logToConsole) {
            console.log(message);
        }
        return messageObj;
    };
    return OttoLogger;
}());
var SocketControl = /** @class */ (function () {
    function SocketControl() {
        this.satellites = [];
        this.appSockets = [];
        this.loggers = {};
    }
    SocketControl.prototype.doLog = function (message) {
        var serverId = 'OTTO_SERVER';
        this.loggers[serverId] = this.loggers[serverId] || new OttoLogger(serverId, constants_1.OttoItemType.Server, true);
        var messageObj = this.loggers[serverId].log(message);
        var messages = [messageObj];
        this.appSockets.forEach(function (appSocket) {
            appSocket.emit('new_log', messages);
        });
    };
    SocketControl.prototype.init = function (http) {
        var _this = this;
        var io = socketIo(http);
        io.on('connection', function (socket) {
            _this.doLog('connection');
            socket.on('bigred', function () {
                _this.doLog('big red connected');
                _this.bigRed = socket;
                _this.bigRed.bigRed = true;
            });
            socket.on('bigred_lights', function (lightObjs) {
                // These have plenty of info on them but for now we only care about a little bit
                _this.doLog('got big red lights, calling update or insert if necessary');
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
                        _this.doLog('could not find group for light id ' + light.id);
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
                _this.doLog('satellite connected with id' + idObj.id);
                db_service_1.dbService.insertSatelliteIfNecessary(idObj.id);
                _this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                socket.satelliteIps = idObj.ips || [];
                var group = _this.findGroupForSatelliteId(idObj.id);
                socket.emit('info', {
                    timeout: group ? group.lightTimeout : null,
                    timeSettings: group ? group.timeSettings : null
                });
            });
            socket.on('satellite_motion_status', function (obj) {
                // We send it piecemeal
                var group = _this.findGroupForSatelliteId(obj.id);
                if (!group) {
                    _this.doLog('could not find group for sat');
                }
                else {
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
                }
            });
            socket.on('app_get_status', function () {
                _this.doLog('app get status was called');
                if (!socket.appId) {
                    socket.appId = uuidv4();
                    _this.appSockets.push(socket);
                }
                _this.doStatus();
            });
            socket.on('refresh_status', function () {
                _this.doStatus();
            });
            socket.on('app_update_program_dev', function () {
                _this.updateProgram(false);
            });
            socket.on('app_update_program_prod', function () {
                _this.updateProgram(true);
            });
            socket.on('app_motion_on', function (groupObj) {
                _this.doLog('turning motion on for group' + groupObj.group);
                var satSocket = _this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    _this.doLog('cant find sat socket for turn motion off');
                }
                else {
                    satSocket.emit('turn_motion_on');
                }
            });
            socket.on('app_motion_off', function (groupObj) {
                _this.doLog('turning motion off for group' + groupObj.group);
                var satSocket = _this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    _this.doLog('cant find sat socket for turn motion off');
                }
                else {
                    satSocket.emit('turn_motion_off');
                }
            });
            socket.on('app_motion_off_temp', function (groupObj) {
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
                _this.doLog('got app scan lights');
                if (_this.bigRed) {
                    _this.bigRed.emit('scan_lights');
                }
            });
            socket.on('app_log_dump', function (idObj) {
                var logDump = [];
                if (!idObj) {
                    for (var key in _this.loggers) {
                        var logger = _this.loggers[key];
                        // TODO App Dump
                    }
                }
                else {
                    var logger = _this.loggers[idObj.id];
                    if (!logger) {
                        logDump = [{
                                ts: new Date(),
                                ms: 'log dump was empty for id ' + idObj.id,
                                id: 'none',
                                type: constants_1.OttoItemType.None
                            }];
                    }
                    else {
                        logDump = logger.messages;
                    }
                }
                socket.emit('log_dump', logDump);
            });
            socket.on('sat_log', function (log) {
                _this.loggers[log.id] = _this.loggers[log.id] || new OttoLogger(log.id, constants_1.OttoItemType.Satellite, false);
                var messageObj = _this.loggers[log.id].log(log.msg);
                var messages = [messageObj];
                _this.appSockets.forEach(function (appSocket) {
                    appSocket.emit('new_log', messages);
                });
            });
            socket.on('satellite_motion_detected', function (idObj) {
                var group = _this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    _this.doLog('could not find group for sat');
                }
                else {
                    var lights = db_service_1.dbService.getLightsForGroupId(group.id);
                    var lightIds = lights.map(function (light) { return light.id; });
                    // TODO: This is a hack for now. It would be a pretty big architechture change where like the lights would belong to metadata groups
                    // -------------------------------------------------------------------
                    var hallwayGroupId = '965d127f-c079-4bbd-8bf3-d016349a71af';
                    var diningRoomLightId = '00:17:88:01:03:44:bd:8f-0b';
                    if (group.id === hallwayGroupId) {
                        // If it's 4, we only turn the hallway light on, which is default
                        // If it's 17, we also turn the dining room light on
                        console.log('it was hallway group id');
                        console.log('pir num ');
                        console.log(idObj.pirnum);
                        console.log(typeof idObj.pirnum);
                        if (idObj.pirnum === '17') {
                            lightIds.push(diningRoomLightId);
                        }
                    }
                    // -------------------------------------------------------------------
                    _this.bigRed && _this.bigRed.emit('turn_lights_on', {
                        lights: lightIds,
                        timeSettings: group.timeSettings
                    });
                }
            });
            socket.on('sat_mot', function (idObj) {
                _this.appSockets.forEach(function (appSocket) {
                    appSocket.emit('sat_mot', idObj);
                });
            });
            socket.on('satellite_motion_timeout', function (idObj) {
                var group = _this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    _this.doLog('could not find group for sat');
                }
                else {
                    var lights = db_service_1.dbService.getLightsForGroupId(group.id);
                    var lightIds = lights.map(function (light) { return light.id; });
                    _this.bigRed && _this.bigRed.emit('turn_lights_off', {
                        lights: lightIds
                    });
                }
            });
            socket.on('satellite_idrsa', function (idrsa) {
                _this.doLog('got idrsa');
                _this.doLog(idrsa);
            });
            socket.on('disconnect', function () {
                _this.doLog('socket disconnect');
                if (socket.bigRed) {
                    _this.bigRed = null;
                    _this.doLog('big red disconnect');
                }
                if (socket.satellite) {
                    _this.doLog('socket is satellite' + socket.satelliteId);
                    for (var i = 0; i < _this.satellites.length; i++) {
                        var sat = _this.satellites[i];
                        if (sat.satelliteId === socket.satelliteId) {
                            _this.satellites.splice(i, 1);
                            _this.doLog('satellite removed');
                            break;
                        }
                    }
                }
                if (socket.appId) {
                    _this.doLog('socket is app' + socket.appId);
                    for (var i = 0; i < _this.appSockets.length; i++) {
                        var app = _this.appSockets[i];
                        if (app.appId === socket.appId) {
                            _this.appSockets.splice(i, 1);
                            _this.doLog('app socket removed');
                            break;
                        }
                    }
                }
                _this.doLog('satellites:');
                _this.doLog(_this.satellites.length);
                _this.doLog('apps:');
                _this.doLog(_this.appSockets.length);
            });
        });
    };
    SocketControl.prototype.doStatus = function () {
        this.doLog('calling do status');
        if (this.bigRed) {
            this.doLog('calling big red get bulb statuses');
            this.bigRed.emit('get_bulb_statuses');
        }
        for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
            var sat = _a[_i];
            sat.emit('get_motion_status');
        }
    };
    SocketControl.prototype.updateProgram = function (doProd) {
        var eventString = "update_program" + (doProd ? '_prod' : '_dev');
        for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
            var satellite = _a[_i];
            satellite.emit(eventString);
        }
    };
    SocketControl.prototype.findSatSocketForGroupId = function (groupId) {
        // For now these actions just grab whatever satellite there is
        var group = db_service_1.dbService.findItemById(groupId, constants_1.OttoItemType.Group);
        if (!group) {
            this.doLog('no group found for ' + groupId);
        }
        else {
            var sat = db_service_1.dbService.findSatelliteForGroup(group.id);
            if (!sat) {
                this.doLog('no sat found for group id ' + group.id);
            }
            else {
                var satSocket = void 0;
                for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
                    var socket = _a[_i];
                    if (socket.satelliteId === sat.id) {
                        return socket;
                    }
                }
            }
        }
    };
    SocketControl.prototype.findGroupForSatelliteId = function (satId) {
        var sat = db_service_1.dbService.findItemById(satId, constants_1.OttoItemType.Satellite);
        if (!sat) {
            return null;
        }
        return db_service_1.dbService.findItemById(sat.group, constants_1.OttoItemType.Group);
    };
    SocketControl.prototype.findGroupForLightId = function (lightId) {
        this.doLog('find gruop for light id ' + lightId);
        var light = db_service_1.dbService.findItemById(lightId, constants_1.OttoItemType.Light);
        if (!light) {
            this.doLog('coudl not find light');
            return null;
        }
        return db_service_1.dbService.findItemById(light.group, constants_1.OttoItemType.Group);
    };
    return SocketControl;
}());
exports.socketControl = new SocketControl();
