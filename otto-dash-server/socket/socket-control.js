"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var uuidv4 = require('uuid/v4');
var socketIo = require('socket.io');
var SocketControl = /** @class */ (function () {
    function SocketControl() {
        this.satellites = [];
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
            socket.on('satellite', function (idObj) {
                console.log('satellite connected with id', idObj.id);
                _this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                socket.emit('info', {
                    timeout: 30 * 60 * 1000
                });
            });
            socket.on('app_get_status', function () {
                console.log('app get status was called');
            });
            socket.on('satellite_motion_detected', function (idObj) {
                // this.bigRed.emit('turn_light_on', idObj);
                // The id is the light
                // We need to get the group ID
                // and then send all lights from that group
            });
            socket.on('satellite_motion_timeout', function (idObj) {
                // this.bigRed.emit('turn_light_off', idObj);
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
                console.log('satellites:');
                console.log(_this.satellites);
            });
        });
    };
    SocketControl.prototype.updateProgram = function () {
        for (var _i = 0, _a = this.satellites; _i < _a.length; _i++) {
            var satellite = _a[_i];
            satellite.emit('update_program');
        }
    };
    return SocketControl;
}());
exports.socketControl = new SocketControl();
