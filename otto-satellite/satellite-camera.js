"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var exec = require('child_process').exec;
var FRAME_RATE = 3;
// Make sure to:
// sudo apt-get install fswebcam
var SatelliteCamera = /** @class */ (function () {
    function SatelliteCamera() {
        this.socket = null;
        this.takePicInterval = null;
    }
    SatelliteCamera.prototype.init = function (socket) {
        var _this = this;
        this.socket = socket;
        socket.on('connect', function () {
            console.log('connected to big red');
            // console.log('calling take pic just the one time');
            socket.emit('satellite');
            // setTimeout(() => {
            //     this.takePic();
            // }, 2000);
        });
        this.takePicInterval = setInterval(function () {
            console.log('taking pic');
            _this.takePic();
        }, 1000 / FRAME_RATE);
    };
    SatelliteCamera.prototype.takePic = function () {
        var _this = this;
        var camProcess = exec('fswebcam --crop 280x280 --no-banner - | base64', function (error, stdout, stderr) {
            // console.log(stdout);
            console.log('took pic', stdout.length);
            if (stdout.length && _this.socket) {
                console.log('emitting to socket');
                _this.socket.emit('image', stdout);
            }
        });
    };
    return SatelliteCamera;
}());
exports.satelliteCamera = new SatelliteCamera();
