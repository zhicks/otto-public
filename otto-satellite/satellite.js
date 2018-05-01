"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../otto-shared/constants");
var OttoSatelliteModule;
(function (OttoSatelliteModule) {
    var path = require('path');
    var express = require('express');
    var app = express();
    var fs = require('fs');
    var http = require('http').Server(app);
    var socketIoClient = require('socket.io-client');
    var SOCKET_ADDRESS = 'http://localhost:3500';
    var ID_FILE_PATH = '../../otto_id';
    var BASH_UPDATE_SCRIPT_FILE_PATH = '../../otto_update_script';
    var DEFAULT_TIMEOUT = 2 * 60 * 1000;
    var uuidv4 = require('uuid/v4');
    var Gpio = require('onoff').Gpio;
    var pir = new Gpio(4, 'in', 'both'); // or 7, I forget
    var TEMP_TIMEOUT_LENGTH = 1 * 60 * 1000;
    var exec = require('child_process').exec;
    var cloudSocket;
    var OttoSatellite = /** @class */ (function () {
        function OttoSatellite() {
            var _this = this;
            this.didSecondaryInit = false;
            this.motionStatus = constants_1.OttoObjectStatus.On;
            this.setMotionTimeout = function () {
                console.log('setting motion timeout');
                _this.motionTimeout = setTimeout(function () {
                    _this.onMotionTimeout();
                }, _this.timeoutLength);
            };
            this.onMotionTimeout = function () {
                console.log('motion timed out, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_timeout', { id: _this.id });
                _this.motionTimeout = null;
            };
        }
        OttoSatellite.prototype.init = function () {
            this.initServer();
            this.initId();
            this.initBashScript();
            this.initSocket();
        };
        OttoSatellite.prototype.secondaryInit = function () {
            this.initMotionDetection();
        };
        OttoSatellite.prototype.initServer = function () {
            app.set('view engine', 'html');
            app.set('port', (process.env.PORT || 3501));
            http.listen(app.get('port'), function () {
                console.log('listening on ' + app.get('port'));
            });
            console.log('satellite server started');
        };
        OttoSatellite.prototype.initBashScript = function () {
            fs.writeFileSync(BASH_UPDATE_SCRIPT_FILE_PATH, BashScript);
        };
        OttoSatellite.prototype.initId = function () {
            try {
                console.log('about to read from id file');
                var data = fs.readFileSync(ID_FILE_PATH).toString();
            }
            catch (e) {
                console.log('id did not exist, writing it');
                this.id = uuidv4();
                console.log('with id ' + this.id);
                fs.writeFileSync(ID_FILE_PATH, this.id);
            }
        };
        OttoSatellite.prototype.initSocket = function () {
            var _this = this;
            cloudSocket = socketIoClient(SOCKET_ADDRESS);
            cloudSocket.on('connect', function () {
                console.log('connection');
                cloudSocket.on('info', function (infoObj) {
                    var timeout = infoObj.timeout;
                    _this.timeoutLength = timeout || DEFAULT_TIMEOUT;
                    console.log('got info from cloud socket: ', infoObj);
                    console.log('time out length is ' + _this.timeoutLength);
                    if (!_this.didSecondaryInit) {
                        console.log('did not init motion yet, calling secondary init for motion');
                        _this.secondaryInit();
                    }
                    else {
                        console.log('already did motion init, just setting timeout');
                    }
                });
                cloudSocket.on('update_program', function () {
                    console.log('update program called');
                    _this.updateProgram();
                });
                cloudSocket.on('turn_motion_on', function () {
                    console.log('turn motion on called');
                    clearTimeout(_this.motionTempOffTimeout);
                    _this.motionStatus = constants_1.OttoObjectStatus.On;
                });
                cloudSocket.on('turn_motion_off', function () {
                    console.log('turn motion off called');
                    clearTimeout(_this.motionTempOffTimeout);
                    _this.motionStatus = constants_1.OttoObjectStatus.Off;
                });
                cloudSocket.on('turn_motion_off_temp', function () {
                    console.log('turn motion off temp called');
                    if (_this.motionStatus !== constants_1.OttoObjectStatus.OffTemporarily) {
                        _this.motionTempOffTimeout = setTimeout(function () {
                            _this.motionStatus = constants_1.OttoObjectStatus.On;
                        }, TEMP_TIMEOUT_LENGTH);
                    }
                    _this.motionStatus = constants_1.OttoObjectStatus.OffTemporarily;
                });
                cloudSocket.on('get_motion_status', function () {
                    cloudSocket.emit('satellite_motion_status', {
                        id: _this.id,
                        status: _this.motionStatus
                    });
                });
                console.log('saying hello to cloud socket, id: ', _this.id);
                cloudSocket.emit('satellite', {
                    id: _this.id
                });
            });
        };
        OttoSatellite.prototype.initMotionDetection = function () {
            var _this = this;
            pir.watch(function (err, value) {
                if (err) {
                    console.log('Error in PIR watch:');
                    console.log(err);
                }
                else {
                    console.log(' ----- motion logged: ', value);
                    if (value === 1) {
                        console.log('value is 1, calling motion detected');
                        _this.onMotionDetected();
                    }
                }
            });
            this.didSecondaryInit = true;
        };
        OttoSatellite.prototype.onMotionDetected = function () {
            // We only care about the 1 - not the 0.
            // The satellite will send that motion was detected
            // and that its timer is done
            if (this.motionTimeout) {
                console.log('motion timeout exists, clearing timeout');
                // It's currently on
                clearTimeout(this.motionTimeout);
            }
            else {
                // This is new
                console.log('motion timeout did not exist, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_detected', { id: this.id });
            }
            this.setMotionTimeout();
        };
        OttoSatellite.prototype.updateProgram = function () {
            console.log('calling update program');
            exec("bash " + BASH_UPDATE_SCRIPT_FILE_PATH, function (err, stdout, stderr) {
                if (err) {
                    console.log('Error updating program');
                    console.log(err);
                }
                console.log(stdout);
            });
        };
        return OttoSatellite;
    }());
    var BashScript = "\n        cd ~/otto;\n        git pull;\n        pkill -f node;\n        node satellite.js;\n    ";
    new OttoSatellite().init();
})(OttoSatelliteModule || (OttoSatelliteModule = {}));
