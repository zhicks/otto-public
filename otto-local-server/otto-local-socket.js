"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var otto_gesture_analysis_1 = require("./otto-gesture-analysis");
var fs = require('fs');
var socketIo = require('socket.io');
var OttoLocalSocket = /** @class */ (function () {
    function OttoLocalSocket() {
        this.browserSockets = {};
    }
    OttoLocalSocket.prototype.init = function (http, posenet, tf) {
        var _this = this;
        this.tf = tf;
        this.posenet = posenet;
        var io = socketIo(http);
        io.on('connection', function (socket) {
            console.log('io on connection');
            // this.browserSockets[socket.id] = socket; // temp!
            _this.tempSocket = socket;
            socket.on('tempOnData', _this.tempOnData.bind(_this));
            socket.on('browser', function () {
                console.log('browser connected');
                _this.browserSockets[socket.id] = socket;
                socket.on('guiState', function (state) {
                    console.log('got gui state, changing it');
                    otto_gesture_analysis_1.ottoGestureAnalysis.changeVariableState(state);
                });
                socket.emit('guiState', otto_gesture_analysis_1.ottoGestureAnalysis.variableState);
            });
            socket.on('satellite', function () {
                console.log('satellite connected');
                socket.on('image', function (image) {
                    console.log('on image hi');
                    if (_this.posenetLocalInstance) {
                        _this.onImage(image);
                    }
                });
            });
            socket.on('disconnect', function () {
                // TODO - This isn't right
                console.log('socket on disconnect');
                var s = _this.browserSockets[socket.id];
                if (s) {
                    console.log('removing browser socket');
                    delete _this.browserSockets[socket.id];
                }
                else {
                    console.log('something went wrong removing the browser socket');
                }
            });
        });
    };
    OttoLocalSocket.prototype.onImage = function (image) {
        var _this = this;
        console.log('got image');
        // console.log(image);
        // fs.writeFileSync('imgtest.txt', image);
        otto_gesture_analysis_1.ottoGestureAnalysis.posenetAnalyze(image, this.tf, this.posenet, this.posenetLocalInstance, function (data) {
            // If there are browsers open, send em this data
            for (var key in _this.browserSockets) {
                var browserSocket = _this.browserSockets[key];
                browserSocket.emit('data', {
                    // image: data.img,
                    data: data
                });
            }
            // Detect gestures
            // ottoGestureAnalysis.analyzeGestures(data.poses, data.imgDims.w, data.imgDims.h, (someKindOfData => {
            //     if (someKindOfData) {
            //         for (let key in this.browserSockets) {
            //             const browserSocket = this.browserSockets[key];
            //             browserSocket.emit('something', someKindOfData)
            //         }
            //     }
            // }));
        });
    };
    OttoLocalSocket.prototype.setPosenetLocalInstance = function (net) {
        this.posenetLocalInstance = net;
    };
    /*
        bigred ts main file -> ottobigredcamera.ts
        ottobigredcamera -> hands an image (video frame) to otto gesture analysis
        otto gesture analysis determines the pose, angles, and if any actions need to be taken
        hands it to this socket class for it to hand to the browser
        hands the browser the image, the pose data, and some state objects that would be
        useful for the browser to show.

        But in the meantime, it will work like:
        browser takes the picture, sends the pose data to the socket
        gesture analysis determines the angles and it any actions need to be taken
        hands it to this socket class for it to hand to the browser
        hands the browser some state objects that would be
        useful for the browser to know.
     */
    OttoLocalSocket.prototype.tempOnData = function (data) {
        // console.log('temp on data');
        otto_gesture_analysis_1.ottoGestureAnalysis.analyzeGestures(data);
    };
    OttoLocalSocket.prototype.tempSendState = function (gestureState) {
        // console.log('sending state 2');
        // for (let key in this.browserSockets) {
        //     // console.log('key in browsersockets');
        //     const browserSocket = this.browserSockets[key];
        //     browserSocket.emit('gestureState', gestureState);
        // }
        this.tempSocket.emit('gestureState', gestureState);
        // this.tempSocket.emit('gestureState', {
        //     test: 'hi'
        // });
    };
    return OttoLocalSocket;
}());
exports.ottoLocalSocket = new OttoLocalSocket();
