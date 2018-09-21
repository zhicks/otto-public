import { ottoLocalSocket } from "./otto-local-socket";
import { ottoSpotifyController } from "./otto-spotify-controller";

const Canvas = require('canvas-prebuilt');
const fs = require('fs');
const Image = Canvas.Image;

declare const require;
declare const Buffer;

// ------------------------------------------------------------------- Interfaces

type PoseDataPart = 'nose' | 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'leftShoulder' | 'rightShoulder' |
    'leftElbow' | 'rightElbow' | 'leftWrist' | 'rightWrist' | 'leftHip' | 'rightHip' | 'leftKnee' |
    'rightKnee' | 'leftAnkle' | 'rightAnkle';

export interface PoseDataKeypoint {
    part: string,
    position: {
        x: number,
        y: number
    },
    score: number
}

export interface PoseData {
    keypoints: PoseDataKeypoint[];
    score: number;
}

// ------------------------------------------------------------------- Gestures

interface OttoGestureRule {
    // Keyed on part
    part: string,
    partRelativeTo?: string,
    minScore?: number,
    angle?: {
        quandrants?: [number, number][],
        degreeFrom: number,
        degreeTo: number
    }
}

interface OttoGesture {
    name: string,
    type: string,
    color: string,
    commandListenInitiator?: {
        arm: string
    }
    rules: {
        [partString: string]: OttoGestureRule
    }
}

interface SuccessfulHitData {
    [partString: string]: {
        part: string,
        x: number,
        y: number
    }
}

const gestures: OttoGesture[] = [
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
                    degreeTo: 45
                }
            },
            leftElbow: {
                part: 'leftElbow',
                partRelativeTo: 'leftWrist',
                angle: {
                    quandrants: [ [-1, 1] ],
                    degreeFrom: 60,
                    degreeTo: 90
                }
            },
            leftEar: {
                part: 'leftEar',
                minScore: 0.4
            },
            rightEar: {
                part: 'rightEar',
                minScore: 0.4
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
                    quandrants: [ [1, 1] ],
                    degreeFrom: 0,
                    degreeTo: 40
                }
            }
        }
    },
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
                    degreeFrom: 0,
                    degreeTo: 40
                }
            }
        }
    },
    {
        name: 'up volume',
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
    }
];

// ------------------------------------------------------------------- Class

class OttoGestureAnalysis {

    // The stuff in the UI is a marriage of this variable state and some stuff from gestureState
    // We send some parts of the gesture state constantly
    variableState = {
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
        commandInitiatorTime: 400,
        commandTimeout: 1000,
        oneTimeCommandTimeout: 1000,
        scaleGestureActionDebounceTime: 100,
        // Making this number smaller means a bigger area of 'thats ok lets do the command'
        scaleMovementDividingFactor: 8
    };

    gestureState = {
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
                successfulHits: <SuccessfulHitData[]> [],
            }
        },
        matchingParts: [],
        scaleGestureActionDebounce: false
    }

    timers = {
        armIsUpAndFaceIsLookingTimer: null,
        commandListenerTimer: null,
        oneTimeCommandTimerForVisualAndPotentiallyTimeWise: null,
        fasterArmIsUpTimerUsedForScaleGestures: null // TODO I'm not sure we need this one. Then again we decided we probably need a different timer
    }

    changeVariableState(state: any) {
        this.variableState = state;
    }

    analyzeGestures(poses: PoseData[]) {
        this.gestureState.timeRelative.commandListenInitiator.hitRate++;
        let matchingParts: {
            [partName: string]: {
                part: string,
                color: string
            }
        } = {};

        // console.log('gestures', gestures.length);
        gestures.forEach((gesture, i) => {

            for (let pose of poses) {
                if (pose.score > 0.15) { // TODO - Pose score
                    const doesMatch = this.doesPoseSatisfyGesture(gesture, pose);
                    if (doesMatch) {
                        this.handleGestureMatch(gesture, pose);
                        Object.keys(gesture.rules).forEach(partString => {
                            matchingParts[partString] = {
                                part: partString,
                                color: gesture.color
                            }
                        });
                        // For now, if we match on any one pose, that's all we need
                        break;
                    }
                }
            }

        });

        this.gestureState.matchingParts = (<any>Object).values(matchingParts);
        this.sendGestureInfo();

    }

    private sendGestureInfo() {
        ottoLocalSocket.tempSendState({
            matchingParts: this.gestureState.matchingParts,
            listeningForCommand: this.gestureState.listeningForCommand
        });
    }

    private handleGestureMatch(gesture: OttoGesture, pose: PoseData) {

        if (gesture.commandListenInitiator) {
            clearTimeout(this.timers.fasterArmIsUpTimerUsedForScaleGestures);
            this.timers.fasterArmIsUpTimerUsedForScaleGestures = setTimeout(() => {
               console.log('arm no longer considered up for gestures');
                this.timers.fasterArmIsUpTimerUsedForScaleGestures = null;
            }, 100);
            this.gestureState.armsUp[gesture.commandListenInitiator.arm] = true;
            let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
            if (!this.timers.armIsUpAndFaceIsLookingTimer) {
                // console.log('starting timer for command listener initiator');
                this.timers.armIsUpAndFaceIsLookingTimer = setTimeout(() => {
                    // console.log('expiring this timeout for command listener initiator');
                    clearTimeout(this.timers.armIsUpAndFaceIsLookingTimer);
                    this.timers.armIsUpAndFaceIsLookingTimer = null;
                    if (commandListenerInitiatorObject.successfulHits.length > commandListenerInitiatorObject.hitRate / 2) {
                        this.gestureState.listeningForCommand = true;
                        console.log('listening for commands');
                        this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = false;
                        this.doScaleAnalyze();
                    }
                    commandListenerInitiatorObject.successfulHits = [];
                    commandListenerInitiatorObject.hitRate = 0;

                    // We call this even if we're not listening for commands
                    this.doSomeTimer();
                }, this.variableState.commandInitiatorTime);
            }

            let successfulHitData: SuccessfulHitData = {};
            let partsOfInterest: {
                [partString: string]: 1
            } = {};
            (<any>Object).values(gesture.rules).forEach(r => {
                partsOfInterest[r.part] = 1;
                if (r.partRelativeTo) {
                    partsOfInterest[r.partRelativeTo] = 1;
                }
            });
            pose.keypoints.filter(k => !!partsOfInterest[k.part]).forEach(k =>
                successfulHitData[k.part] = {
                    x: k.position.x,
                    y: k.position.y,
                    part: k.part
                }
            );
            commandListenerInitiatorObject.successfulHits.push(successfulHitData);

        } else if (this.gestureState.listeningForCommand && !this.gestureState.oneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent) {
            // we do NOT want to call this if this has been called more recently than an armIsUp timer thing
            if (gesture.type === 'one time') {
                if (!this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise) {
                    this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise = setTimeout(() => {
                        this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise = null;
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
    }

    private doGestureAction(gesture: OttoGesture) {
        console.log('+++ doing gesture', gesture.name);
        if (gesture.name === 'Next song') {
            ottoSpotifyController.nextSong();
        } else if (gesture.name === 'Pause play') {
            ottoSpotifyController.pausePlay();
        }
    }

    private doSomeTimer() {
        // if at any point in 500ms we decide the arm is up, this is called.
        // it is the only thing that will make listening for command false.
        // note that listeningForCommand is tied to two different timers! by design.
        clearTimeout(this.timers.commandListenerTimer);
        this.timers.commandListenerTimer = setTimeout(() => {
            console.log('stop listening to commands, this may get called even if were not listening and thats ok');
            this.timers.commandListenerTimer = null;
            this.gestureState.listeningForCommand = false;
            this.gestureState.lastArmUpAverages = null;
        }, this.variableState.commandTimeout);
    }

    private doesPoseSatisfyGesture(gesture: OttoGesture, pose: PoseData) {

        let rulesAsArray = (<any>Object).values(gesture.rules);
        let keypointsWithinRuleThatHaveHighEnoughScore: {
            [part: string]: PoseDataKeypoint
        } = {};
        let matchingRuleCount = 0;

        // Find the keypoints in this pose that have a high enough confidence - only if they're in the rules array for this gesture
        for (let kp of pose.keypoints) {
            if (rulesAsArray.find(t => t.part === kp.part)) {
                let minPartConfidence = 0.1; // TODO - Part score
                if (kp.score > minPartConfidence) {
                    keypointsWithinRuleThatHaveHighEnoughScore[kp.part] = kp;
                }
            }
        }

        // If we've got the same amount of keypoints with high enough score as the amount of rules (which are for each part)
        if (Object.keys(keypointsWithinRuleThatHaveHighEnoughScore).length === rulesAsArray.length) {
            // Here we're confident about where the body parts are - now we see if they match the rules
            if (gesture.type !== 'scale') {
                for (let part in keypointsWithinRuleThatHaveHighEnoughScore) {
                    const kp = keypointsWithinRuleThatHaveHighEnoughScore[part];
                    const rule = gesture.rules[kp.part];
                    if (rule.partRelativeTo) {
                        // Relative checking
                        // @ts-ignore
                        let relativeToKeypoint = pose.keypoints.find(p => p.part === rule.partRelativeTo);
                        if (relativeToKeypoint) {
                            let angleInfo = this.recordAngle(rule, keypointsWithinRuleThatHaveHighEnoughScore[part], relativeToKeypoint);
                            let degreesMatch = angleInfo.degree > rule.angle.degreeFrom && angleInfo.degree < rule.angle.degreeTo;
                            let quandrantsMatch = true;
                            if (rule.angle.quandrants) {
                                quandrantsMatch = false;
                                for (let q of rule.angle.quandrants) {
                                    if (q[0] === angleInfo.quandrant[0] && q[1] === angleInfo.quandrant[1]) {
                                        quandrantsMatch = true;
                                        break;
                                    }
                                }
                            }
                            if (degreesMatch && quandrantsMatch) {
                                matchingRuleCount++;
                            } else {
                                break;
                            }
                        }
                    } else {
                        // Min score checking
                        if (kp.score > rule.minScore) {
                            matchingRuleCount++;
                        } else {
                            break;
                        }
                    }
                }
            } else {
                return this.gestureState.listeningForCommand && this.timers.fasterArmIsUpTimerUsedForScaleGestures;
            }
        }

        return matchingRuleCount === rulesAsArray.length;
    }

    private doScaleAnalyze() {
        // This code is very specific and not generic - a to do for one day

        // We only got here if the arm is up (real time), listening for commands (timer), and the success hits were more than half of the hit rate
        // And it comes directly from the timer that says we should listen to commands.
        let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
        // we need to average the successful hits
        // if the average is above the original by a certain amount, but no more than another amount, it counts as 'up'
        let sums = {
            leftShoulder: { x: 0, y: 0},
            leftElbow: { x: 0, y: 0},
            leftWrist: { x: 0, y: 0},
        };
        commandListenerInitiatorObject.successfulHits.forEach(h => {
            for (let key in sums) {
                sums[key].x += h[key].x;
                sums[key].y += h[key].y;
            }
        });
        const len = commandListenerInitiatorObject.successfulHits.length;
        let currentAverages = {
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
        }
        let lastAverages: typeof currentAverages = this.gestureState.lastArmUpAverages;
        if (lastAverages) {

            const dividingFactor = this.variableState.scaleMovementDividingFactor;

            // This number should always be positive because it's only called if arm is up
            let lengthOfForearm = currentAverages.leftElbow.y - currentAverages.leftWrist.y;

            let elbowUp;
            let wristUp;
            let elbowDown;
            let wristDown;

            if (currentAverages.leftWrist.y < lastAverages.leftWrist.y) {
                // We've gone up
                elbowUp = Math.abs(lastAverages.leftElbow.y - currentAverages.leftElbow.y) > (lengthOfForearm / dividingFactor);
                wristUp = Math.abs(lastAverages.leftWrist.y - currentAverages.leftWrist.y) > (lengthOfForearm / dividingFactor);
            } else {
                // We've gone down
                elbowDown = Math.abs(currentAverages.leftElbow.y - lastAverages.leftElbow.y) > (lengthOfForearm / dividingFactor);
                wristDown = Math.abs(currentAverages.leftWrist.y - lastAverages.leftWrist.y) > (lengthOfForearm / dividingFactor);
            }

            if (elbowUp && wristUp) {
                console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++    UP');
                if (!this.gestureState.scaleGestureActionDebounce) {
                    setTimeout(() => {
                        this.gestureState.scaleGestureActionDebounce = false;
                    }, this.variableState.scaleGestureActionDebounceTime);
                    this.gestureState.scaleGestureActionDebounce = true;
                    ottoSpotifyController.volumeUp();
                }
            }
            if (elbowDown && wristDown) {
                console.log('                  -----------------------------------------         DOWN');
                if (!this.gestureState.scaleGestureActionDebounce) {
                    setTimeout(() => {
                        this.gestureState.scaleGestureActionDebounce = false;
                    }, this.variableState.scaleGestureActionDebounceTime);
                    this.gestureState.scaleGestureActionDebounce = true;
                    ottoSpotifyController.volumeDown();
                }
            }
        }
        this.gestureState.lastArmUpAverages = currentAverages;

    }

    private recordAngle(rule: OttoGestureRule, poseDataKeypoint: PoseDataKeypoint, relativeToKeypoint: PoseDataKeypoint) {
        let pos1 = poseDataKeypoint.position;
        let pos2 = relativeToKeypoint.position;
        let dir = {
            x: pos2.x > pos1.x ? 1 : -1,
            y: pos2.y < pos1.y ? 1 : -1
        };
        let deg: number;
        if (dir.x === 1 && dir.y === 1) {
            let a = this.distance(pos1.x, pos1.y, pos2.x, pos1.y);
            let b = this.distance(pos1.x, pos1.y, pos2.x, pos2.y);
            let c = this.distance(pos2.x, pos2.y, pos2.x, pos1.y);
            deg = this.solveAngle(a, b, c);
        } else if (dir.x === -1 && dir.y === 1) {
            let a = this.distance(pos2.x, pos1.y, pos1.x, pos1.y);
            let b = this.distance(pos2.x, pos2.y, pos2.x, pos1.y);
            let c = this.distance(pos2.x, pos2.y, pos1.x, pos1.y);
            deg = this.solveAngle(a, c, b);
        } else if (dir.x === -1 && dir.y === -1) {
            let a = this.distance(pos2.x, pos2.y, pos1.x, pos2.y);
            let b = this.distance(pos2.x, pos2.y, pos1.x, pos1.y);
            let c = this.distance(pos1.x, pos1.y, pos1.x, pos2.y);
            deg = this.solveAngle(b, c, a);
        } else if (dir.x === 1 && dir.y === -1) {
            let a = this.distance(pos2.x, pos2.y, pos1.x, pos2.y);
            let b = this.distance(pos1.x, pos1.y, pos1.x, pos2.y);
            let c = this.distance(pos1.x, pos1.y, pos2.x, pos2.y);
            deg = this.solveAngle(a, c, b);
        }

        return {
            degree: deg,
            quandrant: [ dir.x, dir.y ]
        };
    }

    private distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    }

    private solveAngle(a, b, c) {
        const temp = (a * a + b * b - c * c) / (2 * a * b);
        if (temp >= -1 && 0.9999999 >= temp)
            return this.radToDeg(Math.acos(temp));
        else if (1 >= temp)  // Explained in https://www.nayuki.io/page/numerically-stable-law-of-cosines
            return this.radToDeg(Math.sqrt((c * c - (a - b) * (a - b)) / (a * b)));
        else
            return null;
    }

    private radToDeg(x) {
        return x / Math.PI * 180;
    }

    // -------------------------------------------------------------------
    // This should almost be in a different class - specifically converts
    // the image and calls posenet detect multiple gestures.
    posenetAnalyze(imageData: any, tf: any, posenet: any, posenetInstance: any, callback: Function) {
        try {
            const now1 = Date.now();
            console.log('analyzing');

            // Image / canvas creation
            const img = new Image();
            console.log('length is');
            console.log(imageData.length);
            // img.src = new Buffer(imageData, 'base64');
            // img.src = new Buffer(imageData);
            img.src = 'data:image/jpeg;base64,' + imageData;
            console.log('got it');
            // fs.writeFileSync('test.jpg', new Buffer(imageData));
            console.log(img.src.length);
            // console.log(imageData);
            const canvas = new Canvas(img.width, img.height);
            const context = canvas.getContext('2d');
            context.drawImage(img, 0, 0, img.width, img.height);

            // Nothing from this will change
            const input = tf.fromPixels(canvas);
            const modelOutputs = posenetInstance.predictForMultiPose(input, this.variableState.multiPoseDetection.outputStride);
            let poseAnalysis = posenet.decodeMultiplePoses(
                modelOutputs.heatmapScores, modelOutputs.offsets,
                modelOutputs.displacementFwd, modelOutputs.displacementBwd,
                this.variableState.multiPoseDetection.outputStride, this.variableState.multiPoseDetection.maxDetections,
                this.variableState.multiPoseDetection);

            console.log('image size is', img.width, img.height);

            poseAnalysis.then((keypointsAndScores: PoseData[]) => {
                // console.log(arguments);
                console.log('that took about (in ms):', Date.now() - now1);

                keypointsAndScores.forEach(k => {
                    console.log('score is', k.score);
                });

                callback({
                    img: canvas.toDataURL(),
                    poses: keypointsAndScores,
                    imgDims: {
                        w: img.width,
                        h: img.height
                    }
                });
            });
        } catch (e) {
            console.log('there was an error with the image');
            console.log(e);
            console.log('gonna try again');
        }
    }

}

export const ottoGestureAnalysis = new OttoGestureAnalysis();

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
