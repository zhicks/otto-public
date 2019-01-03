"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var otto_local_socket_1 = require("./otto-local-socket");
var otto_spotify_controller_1 = require("./otto-spotify-controller");
var Canvas = require('canvas-prebuilt');
var fs = require('fs');
var Image = Canvas.Image;
var huejay = require('huejay');
var TEMP_IS_LIGHTS_INSTEAD_OF_SPOTIFY = false;
var gestures = [
    {
        name: 'Arm is up',
        type: 'commandListener',
        commandListenInitiator: {
            arm: 'right'
        },
        color: 'greenyellow',
        rules: {
            leftShoulder: {
                part: 'leftShoulder',
                partRelativeTo: 'leftElbow',
                angle: {
                    degreeFrom: 0,
                    degreeTo: 53
                }
            },
            leftElbow: {
                part: 'leftElbow',
                partRelativeTo: 'leftWrist',
                angle: {
                    quandrants: [[-1, 1], [1, 1]],
                    degreeFrom: 50,
                    degreeTo: 90
                }
            },
            leftEar: {
                part: 'leftEar',
                minScore: 0.3
            },
            rightEar: {
                part: 'rightEar',
                minScore: 0.3
            }
        }
    },
    {
        name: 'Next song',
        type: 'one time',
        color: 'deeppink',
        rules: {
            leftShoulder: {
                part: 'leftShoulder',
                partRelativeTo: 'leftElbow',
                angle: {
                    degreeFrom: 0,
                    degreeTo: 20
                }
            },
            leftElbow: {
                part: 'leftElbow',
                partRelativeTo: 'leftWrist',
                angle: {
                    quandrants: [[1, 1]],
                    degreeFrom: 0,
                    degreeTo: 36
                }
            }
        }
    },
    // {
    //     name: 'Change color',
    //     type: 'one time',
    //     color: 'yellow',
    //     rules: {
    //         rightShoulder: {
    //             part: 'rightShoulder',
    //             partRelativeTo: 'rightElbow',
    //             angle: {
    //                 degreeFrom: 0,
    //                 degreeTo: 20
    //             }
    //         },
    //         leftElbow: {
    //             part: 'rightElbow',
    //             partRelativeTo: 'rightWrist',
    //             angle: {
    //                 quandrants: [ [-1, 1] ],
    //                 degreeFrom: 0,
    //                 degreeTo: 36
    //             }
    //         }
    //     }
    // },
    {
        name: 'Play pause',
        type: 'one time',
        color: 'magenta',
        rules: {
            leftShoulder: {
                part: 'leftShoulder',
                partRelativeTo: 'leftElbow',
                angle: {
                    degreeFrom: 0,
                    degreeTo: 20
                }
            },
            leftElbow: {
                part: 'leftElbow',
                partRelativeTo: 'leftWrist',
                angle: {
                    quandrants: [[-1, 1]],
                    degreeFrom: 0,
                    degreeTo: 36
                }
            }
        }
    },
    {
        name: 'volume',
        type: 'scale',
        color: 'orange',
        rules: {
            leftElbow: {
                part: 'leftElbow'
            },
            leftWrist: {
                part: 'leftWrist'
            }
        }
    },
];
// ------------------------------------------------------------------- Class
var OttoGestureAnalysis = /** @class */ (function () {
    function OttoGestureAnalysis() {
        // The stuff in the UI is a marriage of this variable state and some stuff from gestureState
        // We send some parts of the gesture state constantly
        this.variableState = {
            multiPoseDetection: {
                outputStride: 16,
                minPartConfidence: 0.5,
                minPoseConfidence: 0.5,
                scoreThreshold: 0.5,
                nmsRadius: 20.0,
                maxDetections: 15,
            },
            showKeypoints: true,
            showSkeleton: true,
            // new variables that should be in the UI
            commandInitiatorTime: 600,
            commandTimeout: 1000,
            oneTimeCommandTimeout: 1000,
            scaleGestureActionDebounceTime: 50,
            // Making this number bigger means a bigger area of 'thats ok lets do the command'
            scaleMovementDividingFactor: 16,
            noLongerConsiderScaleActionsTimerAmount: 80,
            scaleCheckIfShouldDoActionTimerAmount: 160
        };
        this.gestureState = {
            // Note that these aren't variables or settings - they're dynamic state
            lastArmUpAverages: null,
            armsUp: {
                left: false,
                right: false
            },
            listeningForCommand: false,
            oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent: false,
            timeRelative: {
                commandListenInitiator: {
                    hitRate: 0,
                    successfulHits: [],
                }
            },
            matchingParts: [],
            scaleGestureActionDebounce: false
        };
        this.timers = {
            // Timer starts and when it's done will determine if we should start listening for commands
            armIsUpAndFaceIsLookingTimer: null,
            // Determines if we should listen for commands, which may be the case even if the arm isn't up
            commandListenerTimer: null,
            // Specifically for one time commands that should turn the light green for a second
            oneTimeCommandTimerForVisualPurposes: null,
            // Runs for X time. When it's done, it determines if enough movement has happened (and also not too much)
            // for a scale action. It does not get reset - it runs essentially on an interval as long as the arm is up.
            // Pretty much just like the armIsUpAndFaceIsLooking timer
            scaleCheckIfShouldDoActionTimer: null,
            // This timer is specifically for when you put your arm down, you don't want the scale to think it's going down.
            // It gets cleared / reset for every frame that the arm is up.
            // It should always be smaller than the timer amount for determining that a scale action has happened,
            // otherwise, the action could take place and this timer is useless.
            noLongerConsiderScaleActionsTimer: null
        };
    }
    OttoGestureAnalysis.prototype.changeVariableState = function (state) {
        this.variableState = state;
    };
    OttoGestureAnalysis.prototype.analyzeGestures = function (poses) {
        var _this = this;
        this.gestureState.timeRelative.commandListenInitiator.hitRate++;
        var matchingParts = {};
        // console.log('gestures', gestures.length);
        gestures.forEach(function (gesture, i) {
            for (var _i = 0, poses_1 = poses; _i < poses_1.length; _i++) {
                var pose = poses_1[_i];
                if (pose.score > 0.15) { // TODO - Pose score
                    var doesMatch = _this.doesPoseSatisfyGesture(gesture, pose);
                    if (doesMatch) {
                        _this.handleGestureMatch(gesture, pose);
                        Object.keys(gesture.rules).forEach(function (partString) {
                            matchingParts[partString] = {
                                part: partString,
                                color: gesture.color
                            };
                        });
                        // For now, if we match on any one pose, that's all we need
                        break;
                    }
                }
            }
        });
        this.gestureState.matchingParts = Object.values(matchingParts);
        this.sendGestureInfo();
    };
    OttoGestureAnalysis.prototype.sendGestureInfo = function () {
        otto_local_socket_1.ottoLocalSocket.tempSendState({
            matchingParts: this.gestureState.matchingParts,
            listeningForCommand: this.gestureState.listeningForCommand
        });
    };
    OttoGestureAnalysis.prototype.handleGestureMatch = function (gesture, pose) {
        var _this = this;
        // This function gets hit every frame.
        if (gesture.commandListenInitiator) {
            clearTimeout(this.timers.noLongerConsiderScaleActionsTimer);
            this.timers.noLongerConsiderScaleActionsTimer = setTimeout(function () {
                _this.timers.noLongerConsiderScaleActionsTimer = null;
            }, this.variableState.noLongerConsiderScaleActionsTimerAmount);
            var commandListenerInitiatorObject_1 = this.gestureState.timeRelative.commandListenInitiator;
            if (!this.timers.scaleCheckIfShouldDoActionTimer) {
                this.timers.scaleCheckIfShouldDoActionTimer = setTimeout(function () {
                    if (commandListenerInitiatorObject_1.successfulHits.length > commandListenerInitiatorObject_1.hitRate / 2) {
                        _this.doScaleAnalyze(gesture);
                    }
                    _this.timers.scaleCheckIfShouldDoActionTimer = null;
                }, this.variableState.scaleCheckIfShouldDoActionTimerAmount);
            }
            this.gestureState.armsUp[gesture.commandListenInitiator.arm] = true;
            if (!this.timers.armIsUpAndFaceIsLookingTimer) {
                // console.log('starting timer for command listener initiator');
                this.timers.armIsUpAndFaceIsLookingTimer = setTimeout(function () {
                    // console.log('expiring this timeout for command listener initiator');
                    clearTimeout(_this.timers.armIsUpAndFaceIsLookingTimer);
                    _this.timers.armIsUpAndFaceIsLookingTimer = null;
                    if (commandListenerInitiatorObject_1.successfulHits.length > commandListenerInitiatorObject_1.hitRate / 2) {
                        _this.gestureState.listeningForCommand = true;
                        console.log('listening for commands');
                        _this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = false;
                    }
                    commandListenerInitiatorObject_1.successfulHits = [];
                    commandListenerInitiatorObject_1.hitRate = 0;
                    // We call this even if we're not listening for commands
                    _this.doSomeTimer();
                }, this.variableState.commandInitiatorTime);
            }
            var successfulHitData_1 = {};
            var partsOfInterest_1 = {};
            Object.values(gesture.rules).forEach(function (r) {
                partsOfInterest_1[r.part] = 1;
                if (r.partRelativeTo) {
                    partsOfInterest_1[r.partRelativeTo] = 1;
                }
            });
            pose.keypoints.filter(function (k) { return !!partsOfInterest_1[k.part]; }).forEach(function (k) {
                return successfulHitData_1[k.part] = {
                    x: k.position.x,
                    y: k.position.y,
                    part: k.part
                };
            });
            commandListenerInitiatorObject_1.successfulHits.push(successfulHitData_1);
        }
        else if (this.gestureState.listeningForCommand && !this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent) {
            // we do NOT want to call this if this has been called more recently than an armIsUp timer thing
            if (gesture.type === 'one time') {
                if (!this.timers.oneTimeCommandTimerForVisualPurposes) {
                    this.timers.oneTimeCommandTimerForVisualPurposes = setTimeout(function () {
                        _this.timers.oneTimeCommandTimerForVisualPurposes = null;
                        console.log('--- done with the one time command for visual purposes');
                    }, this.variableState.oneTimeCommandTimeout); // This is just for display purposes
                    if (!this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent) {
                        // It may already be true
                        this.doGestureAction(gesture);
                    }
                    this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = true;
                }
            }
        }
    };
    OttoGestureAnalysis.prototype.doGestureAction = function (gesture, tempDirection) {
        console.log('+++ doing gesture', gesture.name);
        if (gesture.name === 'Next song') {
            otto_spotify_controller_1.ottoSpotifyController.nextSong();
        }
        else if (gesture.name === 'Play pause') {
            otto_spotify_controller_1.ottoSpotifyController.pausePlay();
        }
        else if (gesture.name === 'Change color') {
            tempLightStuff.changeColor();
        }
        // else if (gesture.name === 'volume') {
        //     if (tempDirection === 'up') {
        //         ottoSpotifyController.volumeUp();
        //     } else {
        //         ottoSpotifyController.volumeDown();
        //     }
        // }
        // else if (gesture.name === 'lights level') {
        //     if (tempDirection === 'up') {
        //         tempLightStuff.changeLevelUp();
        //     } else {
        //         tempLightStuff.changeLevelDown();
        //     }
        // }
    };
    OttoGestureAnalysis.prototype.doSomeTimer = function () {
        var _this = this;
        // if at any point in 500ms we decide the arm is up, this is called.
        // it is the only thing that will make listening for command false.
        // note that listeningForCommand is tied to two different timers! by design.
        clearTimeout(this.timers.commandListenerTimer);
        this.timers.commandListenerTimer = setTimeout(function () {
            console.log('stop listening to commands, this may get called even if were not listening and thats ok');
            _this.timers.commandListenerTimer = null;
            _this.gestureState.listeningForCommand = false;
            _this.gestureState.lastArmUpAverages = null;
        }, this.variableState.commandTimeout);
    };
    OttoGestureAnalysis.prototype.doesPoseSatisfyGesture = function (gesture, pose) {
        var rulesAsArray = Object.values(gesture.rules);
        var keypointsWithinRuleThatHaveHighEnoughScore = {};
        var matchingRuleCount = 0;
        var _loop_1 = function (kp) {
            if (rulesAsArray.find(function (t) { return t.part === kp.part; })) {
                var minPartConfidence = 0.1; // TODO - Part score
                if (kp.score > minPartConfidence) {
                    keypointsWithinRuleThatHaveHighEnoughScore[kp.part] = kp;
                }
            }
        };
        // Find the keypoints in this pose that have a high enough confidence - only if they're in the rules array for this gesture
        for (var _i = 0, _a = pose.keypoints; _i < _a.length; _i++) {
            var kp = _a[_i];
            _loop_1(kp);
        }
        // If we've got the same amount of keypoints with high enough score as the amount of rules (which are for each part)
        if (Object.keys(keypointsWithinRuleThatHaveHighEnoughScore).length === rulesAsArray.length) {
            // Here we're confident about where the body parts are - now we see if they match the rules
            if (gesture.type !== 'scale') {
                var _loop_2 = function (part) {
                    var kp = keypointsWithinRuleThatHaveHighEnoughScore[part];
                    var rule = gesture.rules[kp.part];
                    if (rule.partRelativeTo) {
                        // Relative checking
                        // @ts-ignore
                        var relativeToKeypoint = pose.keypoints.find(function (p) { return p.part === rule.partRelativeTo; });
                        if (relativeToKeypoint) {
                            var angleInfo = this_1.recordAngle(rule, keypointsWithinRuleThatHaveHighEnoughScore[part], relativeToKeypoint);
                            var degreesMatch = angleInfo.degree > rule.angle.degreeFrom && angleInfo.degree < rule.angle.degreeTo;
                            var quandrantsMatch = true;
                            if (rule.angle.quandrants) {
                                quandrantsMatch = false;
                                for (var _i = 0, _a = rule.angle.quandrants; _i < _a.length; _i++) {
                                    var q = _a[_i];
                                    if (q[0] === angleInfo.quandrant[0] && q[1] === angleInfo.quandrant[1]) {
                                        quandrantsMatch = true;
                                        break;
                                    }
                                }
                            }
                            if (degreesMatch && quandrantsMatch) {
                                matchingRuleCount++;
                            }
                            else {
                                return "break";
                            }
                        }
                    }
                    else {
                        // Min score checking
                        if (kp.score > rule.minScore) {
                            matchingRuleCount++;
                        }
                        else {
                            return "break";
                        }
                    }
                };
                var this_1 = this;
                for (var part in keypointsWithinRuleThatHaveHighEnoughScore) {
                    var state_1 = _loop_2(part);
                    if (state_1 === "break")
                        break;
                }
            }
            else {
                return this.gestureState.listeningForCommand && this.timers.noLongerConsiderScaleActionsTimer;
            }
        }
        return matchingRuleCount === rulesAsArray.length;
    };
    OttoGestureAnalysis.prototype.doScaleAnalyze = function (gesture) {
        // This code is very specific and not generic - a to do for one day
        var _this = this;
        // We only got here if the arm is up (real time), listening for commands, the arm hasn't been put down too quickly,
        // and the success hits were more than half of the hit rate
        var commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
        // we need to average the successful hits
        // if the average is above the original by a certain amount, but no more than another amount, it counts as 'up'
        var sums = {
            leftShoulder: { x: 0, y: 0 },
            leftElbow: { x: 0, y: 0 },
            leftWrist: { x: 0, y: 0 },
        };
        commandListenerInitiatorObject.successfulHits.forEach(function (h) {
            for (var key in sums) {
                sums[key].x += h[key].x;
                sums[key].y += h[key].y;
            }
        });
        var len = commandListenerInitiatorObject.successfulHits.length;
        var currentAverages = {
            leftShoulder: {
                x: sums.leftShoulder.x / len,
                y: sums.leftShoulder.y / len,
            },
            leftElbow: {
                x: sums.leftElbow.x / len,
                y: sums.leftElbow.y / len,
            },
            leftWrist: {
                x: sums.leftWrist.x / len,
                y: sums.leftWrist.y / len,
            },
        };
        var lastAverages = this.gestureState.lastArmUpAverages;
        if (lastAverages) {
            var dividingFactor = this.variableState.scaleMovementDividingFactor;
            // This number should always be positive because it's only called if arm is up
            var lengthOfForearm = currentAverages.leftElbow.y - currentAverages.leftWrist.y;
            var elbowUp = void 0;
            var wristUp = void 0;
            var elbowDown = void 0;
            var wristDown = void 0;
            if (currentAverages.leftWrist.y < lastAverages.leftWrist.y) {
                // We've gone up
                elbowUp = Math.abs(lastAverages.leftElbow.y - currentAverages.leftElbow.y) > (lengthOfForearm / dividingFactor);
                wristUp = Math.abs(lastAverages.leftWrist.y - currentAverages.leftWrist.y) > (lengthOfForearm / dividingFactor);
            }
            else {
                // We've gone down
                elbowDown = Math.abs(currentAverages.leftElbow.y - lastAverages.leftElbow.y) > (lengthOfForearm / dividingFactor);
                wristDown = Math.abs(currentAverages.leftWrist.y - lastAverages.leftWrist.y) > (lengthOfForearm / dividingFactor);
            }
            if (elbowUp && wristUp) {
                console.log('OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO    UP');
                if (!this.gestureState.scaleGestureActionDebounce) {
                    setTimeout(function () {
                        _this.gestureState.scaleGestureActionDebounce = false;
                    }, this.variableState.scaleGestureActionDebounceTime);
                    this.gestureState.scaleGestureActionDebounce = true;
                    if (TEMP_IS_LIGHTS_INSTEAD_OF_SPOTIFY) {
                        tempLightStuff.changeLevelUp();
                    }
                    else {
                        otto_spotify_controller_1.ottoSpotifyController.volumeUp();
                    }
                }
            }
            if (elbowDown && wristDown) {
                console.log('``````````````````````````````````````````````````````````         DOWN');
                if (!this.gestureState.scaleGestureActionDebounce) {
                    setTimeout(function () {
                        _this.gestureState.scaleGestureActionDebounce = false;
                    }, this.variableState.scaleGestureActionDebounceTime);
                    this.gestureState.scaleGestureActionDebounce = true;
                    if (TEMP_IS_LIGHTS_INSTEAD_OF_SPOTIFY) {
                        tempLightStuff.changeLevelDown();
                    }
                    else {
                        otto_spotify_controller_1.ottoSpotifyController.volumeDown();
                    }
                }
            }
        }
        this.gestureState.lastArmUpAverages = currentAverages;
    };
    OttoGestureAnalysis.prototype.recordAngle = function (rule, poseDataKeypoint, relativeToKeypoint) {
        var pos1 = poseDataKeypoint.position;
        var pos2 = relativeToKeypoint.position;
        var dir = {
            x: pos2.x > pos1.x ? 1 : -1,
            y: pos2.y < pos1.y ? 1 : -1
        };
        var deg;
        if (dir.x === 1 && dir.y === 1) {
            var a = this.distance(pos1.x, pos1.y, pos2.x, pos1.y);
            var b = this.distance(pos1.x, pos1.y, pos2.x, pos2.y);
            var c = this.distance(pos2.x, pos2.y, pos2.x, pos1.y);
            deg = this.solveAngle(a, b, c);
        }
        else if (dir.x === -1 && dir.y === 1) {
            var a = this.distance(pos2.x, pos1.y, pos1.x, pos1.y);
            var b = this.distance(pos2.x, pos2.y, pos2.x, pos1.y);
            var c = this.distance(pos2.x, pos2.y, pos1.x, pos1.y);
            deg = this.solveAngle(a, c, b);
        }
        else if (dir.x === -1 && dir.y === -1) {
            var a = this.distance(pos2.x, pos2.y, pos1.x, pos2.y);
            var b = this.distance(pos2.x, pos2.y, pos1.x, pos1.y);
            var c = this.distance(pos1.x, pos1.y, pos1.x, pos2.y);
            deg = this.solveAngle(b, c, a);
        }
        else if (dir.x === 1 && dir.y === -1) {
            var a = this.distance(pos2.x, pos2.y, pos1.x, pos2.y);
            var b = this.distance(pos1.x, pos1.y, pos1.x, pos2.y);
            var c = this.distance(pos1.x, pos1.y, pos2.x, pos2.y);
            deg = this.solveAngle(a, c, b);
        }
        return {
            degree: deg,
            quandrant: [dir.x, dir.y]
        };
    };
    OttoGestureAnalysis.prototype.distance = function (x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };
    OttoGestureAnalysis.prototype.solveAngle = function (a, b, c) {
        var temp = (a * a + b * b - c * c) / (2 * a * b);
        if (temp >= -1 && 0.9999999 >= temp)
            return this.radToDeg(Math.acos(temp));
        else if (1 >= temp) // Explained in https://www.nayuki.io/page/numerically-stable-law-of-cosines
            return this.radToDeg(Math.sqrt((c * c - (a - b) * (a - b)) / (a * b)));
        else
            return null;
    };
    OttoGestureAnalysis.prototype.radToDeg = function (x) {
        return x / Math.PI * 180;
    };
    // -------------------------------------------------------------------
    // This should almost be in a different class - specifically converts
    // the image and calls posenet detect multiple gestures.
    OttoGestureAnalysis.prototype.posenetAnalyze = function (imageData, tf, posenet, posenetInstance, callback) {
        try {
            var now1_1 = Date.now();
            console.log('analyzing');
            // Image / canvas creation
            var img_1 = new Image();
            console.log('length is');
            console.log(imageData.length);
            // img.src = new Buffer(imageData, 'base64');
            // img.src = new Buffer(imageData);
            img_1.src = 'data:image/jpeg;base64,' + imageData;
            console.log('got it');
            // fs.writeFileSync('test.jpg', new Buffer(imageData));
            console.log(img_1.src.length);
            // console.log(imageData);
            var canvas_1 = new Canvas(img_1.width, img_1.height);
            var context = canvas_1.getContext('2d');
            context.drawImage(img_1, 0, 0, img_1.width, img_1.height);
            // Nothing from this will change
            var input = tf.fromPixels(canvas_1);
            var modelOutputs = posenetInstance.predictForMultiPose(input, this.variableState.multiPoseDetection.outputStride);
            var poseAnalysis = posenet.decodeMultiplePoses(modelOutputs.heatmapScores, modelOutputs.offsets, modelOutputs.displacementFwd, modelOutputs.displacementBwd, this.variableState.multiPoseDetection.outputStride, this.variableState.multiPoseDetection.maxDetections, this.variableState.multiPoseDetection);
            console.log('image size is', img_1.width, img_1.height);
            poseAnalysis.then(function (keypointsAndScores) {
                // console.log(arguments);
                console.log('that took about (in ms):', Date.now() - now1_1);
                keypointsAndScores.forEach(function (k) {
                    console.log('score is', k.score);
                });
                callback({
                    img: canvas_1.toDataURL(),
                    poses: keypointsAndScores,
                    imgDims: {
                        w: img_1.width,
                        h: img_1.height
                    }
                });
            });
        }
        catch (e) {
            console.log('there was an error with the image');
            console.log(e);
            console.log('gonna try again');
        }
    };
    return OttoGestureAnalysis;
}());
exports.ottoGestureAnalysis = new OttoGestureAnalysis();
// private checkDistanceMatch(direction: string, rule: OttoGestureRule, kp: PoseDataKeypoint,
//                            relativeToKeypoint: PoseDataKeypoint, compareTo: number) {
//     if (rule.distance[direction].noMoreThan) {
//         let diff = Math.abs(kp.position[direction] - relativeToKeypoint.position[direction]);
//         if (rule.distance[direction].noMoreThan.units === '%') {
//             let pct = (diff / compareTo) * 100;
//             if (pct < rule.distance[direction].noMoreThan.value) {
//                 // We have a match
//                 console.log('We have a match with ', kp.part);
//                 return true;
//             }
//         }
//     }
//     return false;
// }
var TempLightStuff = /** @class */ (function () {
    function TempLightStuff() {
        var _this = this;
        this.colors = [
            'white',
            'green',
            'blue',
            'red'
        ];
        this.currentColor = '';
        this.currentLevel = 50;
        this.setLightsColor = function (brightness) {
            _this.hubClient.lights.getAll().then(function (lights) {
                for (var _i = 0, lights_1 = lights; _i < lights_1.length; _i++) {
                    var light = lights_1[_i];
                    console.log('brightness change: ', brightness);
                    light.brightness = Math.round(254 * brightness);
                    console.log('light brightnes is ', light.brightness);
                    _this.hubClient.lights.save(light);
                }
            })
                .catch(function (error) {
                console.log('hue jay error setLightsBrightness');
                console.log(error);
            });
        };
        this.setLightsBrightness = function (brightness) {
            _this.hubClient.lights.getAll().then(function (lights) {
                for (var _i = 0, lights_2 = lights; _i < lights_2.length; _i++) {
                    var light = lights_2[_i];
                    console.log('brightness change: ', brightness);
                    light.brightness = Math.round(254 * brightness);
                    console.log('light brightnes is ', light.brightness);
                    _this.hubClient.lights.save(light);
                }
            })
                .catch(function (error) {
                console.log('hue jay error setLightsBrightness');
                console.log(error);
            });
        };
    }
    TempLightStuff.prototype.init = function () {
        this.currentColor = this.colors[0];
        this.hubClient = new huejay.Client({
            host: '192.168.1.100',
            port: 80,
            username: '8HeFfV3mq5GswiNZ1ZUcKhi9Nd9Y-Xg33xnoxobW',
            timeout: 15000,
        });
    };
    TempLightStuff.prototype.changeColor = function () {
        // let index = this.colors.findIndex(c => this.currentColor === c);
        // if (index > this.colors.length) {
        //     index = 0;
        // }
        // this.currentColor = this.colors[index];
        // let hue = 0, saturation = 0;
        // switch (this.currentColor) {
        //     case 'white':
        //         hue = 0, saturation = 0;
        //         break;
        //     case 'red':
        //         break;
        //     case 'green':
        //         break;
        //     case 'blue':
        //         break;
        // }
        // this.setLightsColor()
    };
    TempLightStuff.prototype.changeLevelUp = function () {
        this.currentLevel += 16;
        this.currentLevel = Math.min(this.currentLevel, 100);
        this.setLightsBrightness(this.currentLevel / 100);
    };
    TempLightStuff.prototype.changeLevelDown = function () {
        this.currentLevel -= 16;
        this.currentLevel = Math.max(this.currentLevel, 30);
        this.setLightsBrightness(this.currentLevel / 100);
    };
    return TempLightStuff;
}());
var tempLightStuff = new TempLightStuff();
tempLightStuff.init();
