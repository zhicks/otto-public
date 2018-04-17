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
    return SocketControl;
}());
exports.socketControl = new SocketControl();
