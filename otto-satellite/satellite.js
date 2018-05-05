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
    var isProd = process.argv && process.argv[2] === 'prod';
    var SOCKET_ADDRESS = isProd ? 'http://blackboxjs.com:3500' : 'http://192.168.1.102:3500';
    console.log('socket address is ', SOCKET_ADDRESS);
    var ID_FILE_PATH = '../../otto_id';
    var BASH_UPDATE_SCRIPT_FILE_PATH = '../../otto_update_script.sh';
    var DEFAULT_TIMEOUT = 14 * 1000;
    var uuidv4 = require('uuid/v4');
    var Gpio = require('onoff').Gpio;
    var TEMP_TIMEOUT_LENGTH = 5 * 1000;
    var USERNAME = 'sunny';
    var spawn = require('child_process').spawn;
    var os = require('os');
    var cloudSocket;
    var pir4 = new Gpio(4, 'in', 'both');
    var pir17 = new Gpio(17, 'in', 'both');
    // NEXT: Test watching 17 if there's nothing plugged in before trying anything else
    var OttoSatellite = /** @class */ (function () {
        function OttoSatellite() {
            var _this = this;
            this.didSecondaryInit = false;
            this.motionStatus = constants_1.OttoObjectStatus.On;
            this.updateProgramCalled = false;
            this.setMotionTimeout = function () {
                _this.doLog('setting motion timeout');
                _this.motionTimeout = setTimeout(function () {
                    _this.onMotionTimeout();
                }, _this.timeoutLength);
            };
            this.onMotionTimeout = function () {
                _this.doLog('motion timed out, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_timeout', { id: _this.id });
                _this.motionTimeout = null;
            };
        }
        OttoSatellite.prototype.doLog = function (message) {
            console.log(message);
            if (cloudSocket) {
                cloudSocket.emit('sat_log', { id: this.id, msg: message });
            }
        };
        OttoSatellite.prototype.init = function () {
            this.initServer();
            this.initId();
            this.initSocket();
        };
        OttoSatellite.prototype.secondaryInit = function () {
            this.initMotionDetection();
        };
        OttoSatellite.prototype.initServer = function () {
            var _this = this;
            app.set('view engine', 'html');
            app.set('port', (process.env.PORT || 3501));
            http.listen(app.get('port'), function () {
                _this.doLog('listening on ' + app.get('port'));
            });
            this.doLog('satellite server started');
        };
        OttoSatellite.prototype.writeBashScript = function (doProd) {
            fs.writeFileSync(BASH_UPDATE_SCRIPT_FILE_PATH, BashScript(doProd));
        };
        OttoSatellite.prototype.initId = function () {
            try {
                this.doLog('about to read from id file');
                var data = fs.readFileSync(ID_FILE_PATH).toString();
                this.doLog('id from data is ' + JSON.stringify(data));
                this.id = data;
            }
            catch (e) {
                this.doLog('id did not exist, writing it');
                this.id = uuidv4();
                this.doLog('with id ' + this.id);
                fs.writeFileSync(ID_FILE_PATH, this.id);
            }
            try {
                var exists = fs.readFileSync('/home/pi/pi_id_otto_hack');
                this.doLog('username is pi');
                USERNAME = 'pi'; //
            }
            catch (e) {
                this.doLog('username staying as sunny');
            }
        };
        OttoSatellite.prototype.initSocket = function () {
            var _this = this;
            cloudSocket = socketIoClient(SOCKET_ADDRESS);
            cloudSocket.on('connect', function () {
                _this.doLog('connection');
                cloudSocket.on('info', function (infoObj) {
                    var timeout = infoObj.timeout;
                    _this.timeoutLength = timeout || DEFAULT_TIMEOUT;
                    // this.timeoutLength = DEFAULT_TIMEOUT;
                    _this.doLog('got info from cloud socket: ' + JSON.stringify(infoObj));
                    _this.doLog('time out length is ' + _this.timeoutLength);
                    if (!_this.didSecondaryInit) {
                        _this.doLog('did not init motion yet, calling secondary init for motion');
                        _this.secondaryInit();
                    }
                    else {
                        _this.doLog('already did motion init, just setting timeout');
                    }
                });
                cloudSocket.on('update_program_prod', function () {
                    _this.doLog('update program called');
                    _this.updateProgram(true);
                });
                cloudSocket.on('update_program_dev', function () {
                    _this.doLog('update program called');
                    _this.updateProgram(false);
                });
                cloudSocket.on('turn_motion_on', function () {
                    _this.doLog('turn motion on called');
                    clearTimeout(_this.motionTempOffTimeout);
                    clearTimeout(_this.motionTimeout);
                    _this.motionStatus = constants_1.OttoObjectStatus.On;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('turn_motion_off', function () {
                    _this.doLog('turn motion off called');
                    clearTimeout(_this.motionTempOffTimeout);
                    clearTimeout(_this.motionTimeout);
                    _this.motionStatus = constants_1.OttoObjectStatus.Off;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('turn_motion_off_temp', function () {
                    _this.doLog('turn motion off temp called');
                    if (_this.motionStatus !== constants_1.OttoObjectStatus.OffTemporarily) {
                        _this.motionTempOffTimeout = setTimeout(function () {
                            _this.motionStatus = constants_1.OttoObjectStatus.On;
                        }, TEMP_TIMEOUT_LENGTH);
                    }
                    _this.motionStatus = constants_1.OttoObjectStatus.OffTemporarily;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('get_motion_status', function () {
                    cloudSocket.emit('satellite_motion_status', {
                        id: _this.id,
                        status: _this.motionStatus
                    });
                });
                cloudSocket.on('ping', function () {
                    // this.doLog(`cloud socket ping ${new Date()}`);
                    // cloudSocket.emit('pong', { id: this.id });
                });
                _this.doLog('saying hello to cloud socket, id: ' + _this.id);
                var ips = [];
                try {
                    var ifaces_1 = os.networkInterfaces();
                    Object.keys(ifaces_1).forEach(function (ifname) {
                        var alias = 0;
                        ifaces_1[ifname].forEach(function (iface) {
                            if ('IPv4' !== iface.family || iface.internal !== false) {
                                return;
                            }
                            ips.push(iface.address);
                            ++alias;
                        });
                    });
                }
                catch (e) {
                    _this.doLog('error when getting the ip');
                }
                cloudSocket.emit('satellite', {
                    id: _this.id,
                    ips: ips
                });
            });
        };
        OttoSatellite.prototype.innerInitMotionDetection = function (err, value, pirnum) {
            if (err) {
                this.doLog("Error in PIR watch " + pirnum + ":");
                this.doLog(err);
            }
            else {
                this.doLog(" ----- m " + pirnum + ": " + value);
                if (value === 1) {
                    if (cloudSocket) {
                        this.doLog("emitting motion to cloud " + pirnum);
                        cloudSocket.emit('sat_mot', {
                            id: this.id,
                            pirnum: pirnum
                        });
                    }
                    if (this.motionStatus === constants_1.OttoObjectStatus.On) {
                        this.doLog('calling motion detected');
                        this.onMotionDetected();
                    }
                    else {
                        this.doLog('not calling motion detected');
                    }
                }
            }
        };
        OttoSatellite.prototype.initMotionDetection = function () {
            var _this = this;
            pir4.watch(function (err, value) {
                _this.innerInitMotionDetection(err, value, '4');
            });
            pir17.watch(function (err, value) {
                _this.innerInitMotionDetection(err, value, '17');
            });
            this.didSecondaryInit = true;
        };
        OttoSatellite.prototype.onMotionDetected = function () {
            // We only care about the 1 - not the 0.
            // The satellite will send that motion was detected
            // and that its timer is done
            if (this.motionTimeout) {
                this.doLog('motion timeout exists, clearing timeout');
                // It's currently on
                clearTimeout(this.motionTimeout);
            }
            else {
                // This is new
                this.doLog('motion timeout did not exist, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_detected', { id: this.id });
            }
            this.setMotionTimeout();
        };
        OttoSatellite.prototype.updateProgram = function (doProd) {
            if (!this.updateProgramCalled) {
                this.doLog("calling update program - doProd: " + doProd);
                this.writeBashScript(doProd);
                spawn("bash", [BASH_UPDATE_SCRIPT_FILE_PATH], {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: 'inherit'
                });
                this.updateProgramCalled = true;
            }
        };
        return OttoSatellite;
    }());
    var BashScript = function (doProd) {
        return "\n        pkill -f node;\n        cd /home/" + USERNAME + "/otto/otto-satellite;\n        git stash;\n        git clean  -d  -fx .;\n        git pull;\n        npm install;\n        npm run start" + (doProd ? "-prod" : '') + ";\n    ";
    };
    new OttoSatellite().init();
})(OttoSatelliteModule || (OttoSatelliteModule = {}));
