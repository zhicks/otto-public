import { ottoLocalSocket } from "./otto-local-socket";
import { ottoSpotifyController } from "./otto-spotify-controller";

const Canvas = require('canvas-prebuilt');
const fs = require('fs');
const Image = Canvas.Image;

declare const require;
declare const Buffer;

// ------------------------------------------------------------------- Interfaces
// enum PoseDataPart {
//     nose = 'nose',
//     leftEye = 'leftEye',
//     rightEye = 'rightEye',
//     leftEar = 'leftEar',
//     rightEar = 'rightEar',
//     leftShoulder = 'leftShoulder',
//     rightShoulder = 'rightShoulder',
//     leftElbow = 'leftElbow',
//     rightElbow = 'rightElbow',
//     leftWrist = 'leftWrist',
//     rightWrist = 'rightWrist',
//     leftHip = 'leftHip',
//     rightHip = 'rightHip',
//     leftKnee = 'leftKnee',
//     rightKnee = 'rightKnee',
//     leftAnkle = 'leftAnkle',
//     rightAnkle = 'rightAnkle'
// }

// TODO - The RPis apparently cant handle this atm
// type PoseDataPart = 'nose' | 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'leftShoulder' | 'rightShoulder' |
//     'leftElbow' | 'rightElbow' | 'leftWrist' | 'rightWrist' | 'leftHip' | 'rightHip' | 'leftKnee' |
//     'rightKnee' | 'leftAnkle' | 'rightAnkle';

export interface PoseDataKeypoint {
    // part: PoseDataPart, // TODO
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

// interface OttoGestureRuleDistanceRequirement {
//     noMoreThan?: {
//         value: number,
//         units: string
//     }
// }

interface OttoGestureRule {
    // Keyed on part
    part: string,
    partRelativeTo?: string,
    minScore?: number,
    angle?: {
        quandrants?: [number, number][],
        degreeFrom: number,
        degreeTo: number
    },
    something?: boolean
}

interface OttoGesture {
    // successText: string,
    // showInBrowserOnSuccess: string,
    // action: any,
    // something: {
    //
    // }
    // requirement: {
    //
    // }
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
                    quandrants: [ [1, 1], [-1, 1] ],
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
        name: 'switch songs',
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
                part: 'leftElbow',
                something: true
            },
            leftWrist: {
                part: 'leftWrist',
                something: true
            }
        }
    }
];

// ------------------------------------------------------------------- Class

class OttoGestureAnalysis {

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
        showSkeleton: true
    };

    // Wanted this to be in gesture state but will have to keep track of it (serialization gives stack overflow)
    timers = {
        armIsUpTimer: null,
        commandListenerTimer: null,
        oneTimeCommandTimerForVisualAndPotentiallyTimeWise: null,
        tempTimeout: null,
        TEMP_armIsUpTimeout: null, // TODO - there is an armIsUpTimer right above us - most likely the same goddamn thing
        // TEMP_scaleTimeout: null
    }

    gestureState = {
        // $f: {
        //   lastArmPos: {
        //       // shoulder: { x: null, y: null },
        //       leftElbow: { x: null, y: null },
        //       leftWrist: { x: null, y: null }
        //   }
        // },
        TEMP_lastAverages: null,
        armsUp: {
            left: false,
            right: false
        },
        // oneTimeCommandIndicator: false,
        listeningForCommand: false,
        shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent: false,
        timeRelative: {
            commandListenInitiator: {
                hitRate: 0,
                // for every successful arm is up recognition within the timeframe, this will have leftShoulder, leftElbow and leftWrist
                // or at least (leftElbow and leftWrist)
                // those objects will have x and y, which will be averaged.
                successfulHits: <SuccessfulHitData[]> [],
                timerAmount: 400
            },
            commandListener: {
                timerAmount: 1000,
                oneTimeCommandTimerForVisualAndPotentiallyTimeWiseAmount: 1000
            }
        },
        matchingParts: []
        // angles: {
        //
        // }
        // lightState: {
        //
        // }
    }
    private TEMPwaitForSpotifyCommandSoNoRepeatsTooFast = false;

    changeVariableState(state: any) {
        this.variableState = state;
    }


    analyzeGestures(poses: PoseData[]) {

        // console.log('analyze gestures');
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

        // console.log(this.gestureState.$f.lastArmPos);
        this.gestureState.matchingParts = (<any>Object).values(matchingParts);
        this.sendGestureState();

        /*
            the listening for command thing aint that hard:
            when it sees an arm up it starts a timer of 500ms
            if after 500ms it has less than half of a hit rate,
            it will reset.
            the 'is arm up', the '500ms' and the 'listening for command'
            need to be well separated! becuase we want to be able
            to come back to blue after giving a command.

            easy. when it lands, we don't care about that timer anymore.
            we want the light to stay on as long as the arm is up.
            so the new timer here is one, say 700ms, that gets reset
            every time we get a new 'arm is up.' when the arm goes down,
            that 700ms will expire and the light goes off.
            this is also the same timer that, if active, means the
            we're listening for a command, and so the switch and volume
            controls depend on this timer.

            when we swing the arm to the right, the arm is no longer 'up'.
            but let's assume that the arm can be up as well until we get
            facial recognition.
            so the 700ms timer wants to go on, but it's killed.
            we start a new timer of maybe a second. this timer says
            'ok cool i'm issuing this type of command and not listening
            to anything else you're doing for a second.'
            but it will still be looking for an arm up. because we want it
            to go right back to blue if we want to.

            now when we do volume control - we check to see if it's blue,
            and if it is, we're keeping a close eye on the position and
            angle of the elbow to wrist. it needs to be 'arm is up' (according
            to that timer up there). each frame needs to be within one
            quarter of the height of their elbow to wrist distance and the
            angle needs to be decreasing maybe.

         */

    }

    private sendGestureState() {
        // console.log('sending state');
        ottoLocalSocket.tempSendState(this.gestureState);
    }

    private handleGestureMatch(gesture: OttoGesture, pose: PoseData) {

        if (gesture.commandListenInitiator) {
            clearTimeout(this.timers.TEMP_armIsUpTimeout);
            this.timers.TEMP_armIsUpTimeout = setTimeout(() => {
               console.log('arm is no longer up');
                this.timers.TEMP_armIsUpTimeout = null;
            }, 100);
            this.gestureState.armsUp[gesture.commandListenInitiator.arm] = true;
            let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
            // If we're already listening for a command, there's another timer that will set
            // it to not listening anymore. We only care about the timer to determine that
            // we should listen.
            if (!this.timers.armIsUpTimer) {
                // console.log('starting timer for command listener initiator');
                // console.log('deciding if we should listen for commands');
                this.timers.armIsUpTimer = setTimeout(() => {
                    // console.log('expiring this timeout for command listener initiator');

                    clearTimeout(this.timers.armIsUpTimer);
                    this.timers.armIsUpTimer = null;
                    if (commandListenerInitiatorObject.successfulHits.length > commandListenerInitiatorObject.hitRate / 2) {
                        // this.handleGestureAction(gesture);
                        // this.listenForCommandAgainIfNecess();
                        this.gestureState.listeningForCommand = true;
                        console.log('listening for commands');
                        this.gestureState.shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = false;
                        this.doScaleAnalyze();
                    }
                    commandListenerInitiatorObject.successfulHits = [];
                    commandListenerInitiatorObject.hitRate = 0;

                    // We call this even if we're not listening for commands
                    this.doSomeTimer();
                    // console.log('here');


                }, commandListenerInitiatorObject.timerAmount);
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
        }


        /*
        NEW:
        not listening for command. arm goes up. 500ms later it starts listening.
        no more 500ms timer. new 700ms timer. one time command is issued.
        it does not block - it just lights up for the 1000ms. it says
        that we are no longer listening for a command, and the 500ms timer is gone,
        so we start listening for the timer again. the 1000ms when it ends will
        clear the green light if it's there, but if we're listening for command,
        it doesn't.
         */

        else if (this.gestureState.listeningForCommand && !this.gestureState.shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent) {
            // we do NOT want to call this if this has been called more recently than an armIsUp timer thing
            if (gesture.type === 'one time') {
                let commandListenerObject = this.gestureState.timeRelative.commandListener;
                // this.stopListeningForCommand();
                // this.gestureState.oneTimeCommandIndicator = true;
                if (!this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise) {
                    // at this point, the gesture is not quite
                    this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise = setTimeout(() => {
                        // console.log('clearing blocked timer');
                        // clearTimeout(this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise);
                        this.timers.oneTimeCommandTimerForVisualAndPotentiallyTimeWise = null;
                        console.log('--- done with the one time command for visual purposes');
                        // if (!this.gestureState.listeningForCommand) {
                        //     this.gestureState.oneTimeCommandIndicator = false;
                        // }
                    }, commandListenerObject.oneTimeCommandTimerForVisualAndPotentiallyTimeWiseAmount); // This is just for display purposes
                    if (!this.gestureState.shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent) {
                        // It may already be true
                        this.doGestureAction(gesture);
                    }
                    this.gestureState.shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = true;
                }
            }

            /*
                now when we do volume control - we check to see if it's blue,
                and if it is, we're keeping a close eye on the position and
                angle of the elbow to wrist. it needs to be 'arm is up' (according
                to that timer up there). each frame needs to be within one
                quarter of the height of their elbow to wrist distance and the
                angle needs to be decreasing maybe.
             */
            // Ignore that above. Taken care of with the 500ms timer
            // if (gesture.type === 'scale') {
            //     // if (!this.timers.TEMP_scaleTimeout) {
            //     //     console.log('listening for scale gesture');
            //     // }
            //     // clearTimeout(this.timers.TEMP_scaleTimeout);
            //     // this.timers.TEMP_scaleTimeout = setTimeout(() => {
            //     //    console.log('time out for scale timeout');
            //     //     this.timers.TEMP_scaleTimeout = null;
            //     // }, 200);
            // }
        }

    }

    // private listenForCommandAgainIfNecess() {
    //
    //     // new: problem is that it stops the listening for the command and we have another half second
    //     // the timer is fine - it needs to call this again
    //     // so it shouldnt be stopped
    //
    //
    //     // arm up -> timer after a while agrees -> listeningForCommand = true
    //     // after 700ms, we check again. isArmStillUp may be the way to go.
    //     // more importantly: we get pose data ever 1/25 of a second
    //     // for every one of those, if the arm is still up (score?),
    //     // we clear the timeout to stopListening
    //     // this function should get called every time, but stopListening should not
    //
    //
    //
    //
    //
    //
    //     console.log('listen for command');
    //     // easy. when it lands, we don't care about that timer anymore.
    //     // we want the light to stay on as long as the arm is up.
    //     //     so the new timer here is one, say 700ms, that gets reset
    //     // every time we get a new 'arm is up.' when the arm goes down,
    //     //     that 700ms will expire and the light goes off.
    //     //     this is also the same timer that, if active, means the
    //     // we're listening for a command, and so the switch and volume
    //     // controls depend on this timer.
    //     this.gestureState.listeningForCommand = true;
    //     // let commandListenerObject = this.gestureState.timeRelative.commandListener;
    //
    //     // we're gonna set another timer that makes listeningForCommand untrue
    //
    //     // clearTimeout(this.timers.commandListenerTimer);
    //     // this.timers.commandListenerTimer = setTimeout(() => {
    //     //     // console.log('command listener timeout, clearing');
    //     //     // this.stopListeningForCommand();
    //     //
    //     // }, commandListenerObject.timerAmount);
    // }

    private doGestureAction(gesture: OttoGesture) {
        console.log('+++ doing gesture', gesture.name);
        if (gesture.name === 'switch songs') {
            ottoSpotifyController.nextSong();
        }
    }

    private doSomeTimer() {
        // if at any point in 500ms we decide the arm is up, this is called.
        // it is the only thing that will make listening for command false.
        // note that listeningForCommand is tied to two different timers! by design.

        // console.log('do some timer');
        clearTimeout(this.timers.commandListenerTimer);
        this.timers.commandListenerTimer = setTimeout(() => {
            console.log('stop listening to commands, this may get called even if were not listening and thats ok');
            this.timers.commandListenerTimer = null;
            this.gestureState.listeningForCommand = false;
            this.gestureState.TEMP_lastAverages = null;
        }, this.gestureState.timeRelative.commandListener.timerAmount);
    }

    // private stopListeningForCommand() {
    //     console.log('stop listening for command');
    //     this.gestureState.listeningForCommand = false;
    // }

    private doesPoseSatisfyGesture(gesture: OttoGesture, pose: PoseData) {

        // console.log('does pose satisfy');
        let rulesAsArray = (<any>Object).values(gesture.rules);
        let keypointsWithinRuleThatHaveHighEnoughScore: {
            [part: string]: PoseDataKeypoint
        } = {};
        let matchingRuleCount = 0;

        // Find the keypoints in this pose that have a high enough confidence - only if they're in the rules array for this gesture
        for (let kp of pose.keypoints) {
            if (rulesAsArray.find(t => t.part === kp.part)) {
                // let minPartConfidence = this.variableState.multiPoseDetection.minPartConfidence;
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
                //
                // for (let part in keypointsWithinRuleThatHaveHighEnoughScore) {
                //
                // }
                return this.gestureState.listeningForCommand && this.timers.TEMP_armIsUpTimeout;
            }
        }

        // console.log('poses matches? ', matchingRuleCount === rulesAsArray.length);
        if (matchingRuleCount === rulesAsArray.length) {
            // if (gesture.name === 'Arm is up') {
            //     // @ts-ignore
            //     this.gestureState.$f.lastArmPos.leftElbow = pose.keypoints.find(p => p.part === 'leftElbow').position;
            //     // @ts-ignore
            //     this.gestureState.$f.lastArmPos.leftWrist = pose.keypoints.find(p => p.part === 'leftWrist').position;
            // }
            return true;
        }
        return false;
    }

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

    private recordAngle(rule: OttoGestureRule, poseDataKeypoint: PoseDataKeypoint, relativeToKeypoint: PoseDataKeypoint) {
        // console.log('record angle');
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

        // not great code but we can take the parts we know about here and put em on the map
        // this.gestureState.angles[rule.part + '-' + rule.partRelativeTo] = deg;
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

    private doScaleAnalyze() {
        // We only got here if the arm is up (real time), listening for commands (timer), and the success hits were more than half of the hit rate
        // And it comes directly from the timer that says we should listen to commands.
        let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
        // commandListenerInitiatorObject.successfulHits
        // we need to average the successful hits
        // if the average is above the original by a certain amount, but no more than another amount, it counts as 'up'
        let sums = {
            leftShoulder: { x: 0, y: 0},
            leftElbow: { x: 0, y: 0},
            leftWrist: { x: 0, y: 0},
        };
        // console.log('successful hits is');
        // console.log(commandListenerInitiatorObject.successfulHits.length);
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
        // console.log('averages is');
        // console.log(averages);
        let lastAverages: typeof currentAverages = this.gestureState.TEMP_lastAverages;
        if (lastAverages) {

            // Making this number smaller means a bigger area of 'thats ok lets do the command'
            const dividingFactor = 8;

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
                if (!this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast) {
                    setTimeout(() => {
                        this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast = false;
                    }, 100);
                    this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast = true;
                    ottoSpotifyController.volumeUp();
                }
            }
            if (elbowDown && wristDown) {
                console.log('                  -----------------------------------------         DOWN');
                if (!this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast) {
                    setTimeout(() => {
                        this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast = false;
                    }, 100);
                    this.TEMPwaitForSpotifyCommandSoNoRepeatsTooFast = true;
                    ottoSpotifyController.volumeDown();
                }
            }
        }
        this.gestureState.TEMP_lastAverages = currentAverages;
    }
}

export const ottoGestureAnalysis = new OttoGestureAnalysis();