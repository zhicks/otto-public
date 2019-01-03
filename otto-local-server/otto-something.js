"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Canvas = require('canvas-prebuilt');
var Image = Canvas.Image;
var OttoSomething = /** @class */ (function () {
    function OttoSomething() {
    }
    OttoSomething.prototype.analyze = function (imageData, tf, posenet, posenetInstance, guiState, callback) {
        var now1 = Date.now();
        console.log('analyzing');
        var img = new Image();
        img.src = imageData;
        var canvas = new Canvas(img.width, img.height);
        var context = canvas.getContext('2d');
        console.log('image size is', img.width, img.height);
        context.drawImage(img, 0, 0, img.width, img.height);
        var input = tf.fromPixels(canvas);
        console.log('analyize');
        var modelOutputs = posenetInstance.predictForMultiPose(input, guiState.outputStride);
        var poseAnalysis = posenet.decodeMultiplePoses(modelOutputs.heatmapScores, modelOutputs.offsets, modelOutputs.displacementFwd, modelOutputs.displacementBwd, guiState.outputStride, guiState.multiPoseDetection.maxDetections, guiState.multiPoseDetection);
        poseAnalysis.then(function (keypointsAndScores) {
            // console.log(arguments);
            var now2 = Date.now();
            console.log('that took about (in ms):', now2 - now1);
            keypointsAndScores.forEach(function (k) {
                console.log('score is', k.score);
            });
            callback(keypointsAndScores);
        });
    };
    return OttoSomething;
}());
exports.ottoSomething = new OttoSomething();
