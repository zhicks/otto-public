import { ottoLocalSocket } from "./otto-local-socket";

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
    part: string, // PoseDataKeypoint,
    partRelativeTo: string, //PoseDataKeypoint,
    // distance: {
    //     x?: OttoGestureRuleDistanceRequirement,
    //     y?: OttoGestureRuleDistanceRequirement
    // }
    angle: {
        quandrant?: [number, number],
        degreeFrom: number,
        degreeTo: number
    }
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
    commandListenInitiator?: {
        arm: string
    }
    rules: {
        [partString: string]: OttoGestureRule
    }
}

const gestures: OttoGesture[] = [
    {
        name: 'arm is up',
        type: 'commandListener',
        commandListenInitiator: {
            arm: 'right'
        },
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
                    // TODO - Needs quandrants
                    degreeFrom: 60,
                    degreeTo: 90
                }
            }
        }
    },
    {
        name: 'switch songs',
        type: 'one time',
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
        tempTimeout: null
    }

    gestureState = {
        // ruleNames: [],
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
                hitRateSuccess: 0,
                timerAmount: 400
            },
            commandListener: {
                timerAmount: 1000, // TODO - there is a lot of tweaking here on multiple parameters
                oneTimeCommandTimerForVisualAndPotentiallyTimeWiseAmount: 1000
            }
        },
        // angles: {
        //
        // }
        // lightState: {
        //
        // }
    }

    changeVariableState(state: any) {
        this.variableState = state;
    }


    analyzeGestures(poses: PoseData[]) {

        // console.log('analyze gestures');
        this.gestureState.timeRelative.commandListenInitiator.hitRate++;

        // console.log('gestures', gestures.length);
        gestures.forEach((gesture, i) => {

            for (let pose of poses) {
                if (pose.score > 0.15) { // TODO - Pose score
                    const doesMatch = this.doesPoseSatisfyGesture(gesture, pose);
                    if (doesMatch) {
                        this.handleGestureMatch(gesture);
                        // For now, if we match on any one pose, that's all we need
                        break;
                    }
                }
            }

        });

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

        // let someKindOfData = null;
        // poses.forEach(pose => {
        //     if (pose.score > this.variableState.multiPoseDetection.minPoseConfidence) {
        //         let thing: any;
        //         let neededKeypointRules = thing.thing2;
        //         let goodKeypoints: {
        //             [part: string]: PoseDataKeypoint
        //         } = {};
        //         for (let kp of pose.keypoints) {
        //             if (neededKeypointRules.find(t => t.part === kp.part)) {
        //                 console.log('got part ', kp.part, ' with score ', kp.score);
        //                 if (kp.score < this.variableState.multiPoseDetection.minPartConfidence) {
        //                     console.log('breaking out - score not good enough');
        //                     break;
        //                 } else {
        //                     goodKeypoints[kp.part] = kp;
        //                 }
        //             }
        //         }
        //         if (goodKeypoints.length === neededKeypointRules.length) {
        //             // Here we're confident about where the body parts are - now we see if they match the rules
        //             let matchingRuleCount = 0;
        //             for (let part in goodKeypoints) {
        //                 const kp = goodKeypoints[part];
        //                 const rule: OttoGestureRule = thing.rules[kp.part];
        //                 // this would be shoulder
        //                 let relativeToKeypoint: PoseDataKeypoint = pose.keypoints.find(p => p.part === rule.partRelativeTo.part);
        //                 if (relativeToKeypoint) {
        //                     // So now we have found the part and the relative to part.
        //                     // We need to see the requirement, in this case distance
        //                     if (rule.distance) {
        //                         let matched = false;
        //                         if (rule.distance.x) {
        //                             matched = this.checkDistanceMatch('x', rule, kp, relativeToKeypoint, imgWidth);
        //                         }
        //                         if (rule.distance.y) {
        //                             matched = this.checkDistanceMatch('y', rule, kp, relativeToKeypoint, imgHeight);
        //                         }
        //                         if (!matched) {
        //                             break;
        //                         } else {
        //                             matchingRuleCount++;
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // });

        // callback(someKindOfData);
    }

    private sendGestureState() {
        // console.log('sending state');
        ottoLocalSocket.tempSendState(this.gestureState);
    }

    private handleGestureMatch(gesture: OttoGesture) {
        // This was doGestureAction but it's not really about doing the action
        // it's about handling it in general

        // the listening for command thing aint that hard:
        //     when it sees an arm up it starts a timer of 500ms
        // if after 500ms it has less than half of a hit rate,
        //     it will reset.
        //     the 'is arm up', the '500ms' and the 'listening for command'
        // need to be well separated! becuase we want to be able
        // to come back to blue after giving a command.

        // NEW:
        // when it sees an arm up it starts a timer of 500ms
        // if the arm was already up it just resets that timer (this part!)
        // when it sees an arm up it starts a timer of 500ms -> listen



        // // new
        // if (gesture.commandListenInitiator) {
        //     this.gestureState.armsUp[gesture.commandListenInitiator.arm] = true;
        //     // console.log('arm is up');
        //     // TODO - arm up is never set to false - we'll have to go outside the function for that
        //     let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;
        //     // either the arm is up or not for every 500ms. this is not the timer that determines
        //     // if it's an action that should be delivered (although it is the timer that determines
        //     // that the arms is down -- those two things together will be slightly complicated).
        //     // when the arm goes from up to not, we look at one time commands.
        //     // if "noLongerListeningToCommands"
        //     // we raise the arm back up and its listening for commands again - the green has
        //     // nothing to do with it.
        //
        //     // every 500ms, we check to see if that 'queue' (hitRate) means we still have the arm up
        //     //
        //     // if (!this.timers.armIsUpTimer) {
        //     //     // IF we already have a timer going we'll keep it going - 500ms - it is appropriate I think
        //     //     console.log('listening for commands, setting timeout');
        //     //     clearTimeout(this.timers.armIsUpTimer);
        //     //     this.timers.armIsUpTimer = setTimeout(() => {
        //     //         clearTimeout(this.timers.armIsUpTimer);
        //     //         this.timers.armIsUpTimer = null;
        //     //         console.log('arm is def no longer up, no longer listening for commands');
        //     //     }, commandListenerInitiatorObject.timerAmount);
        //     // }
        //
        //     // console.log('listening for commands, setting timeout');
        //     if (!this.timers.tempTimeout) {
        //
        //         this.timers.tempTimeout = setTimeout(() => {
        //             if (commandListenerInitiatorObject.hitRateSuccess > commandListenerInitiatorObject.hitRate / 2) {
        //                 console.log('arm is finally up right?');
        //             }
        //
        //             commandListenerInitiatorObject.hitRateSuccess = 0;
        //             commandListenerInitiatorObject.hitRate = 0;
        //         }, 2000);
        //     }
        //
        //     commandListenerInitiatorObject.hitRateSuccess++;
        //
        //     // clearTimeout(this.timers.armIsUpTimer);
        //     // this.timers.armIsUpTimer = setTimeout(() => {
        //     //     clearTimeout(this.timers.armIsUpTimer);
        //     //     this.timers.armIsUpTimer = null;
        //     //     console.log('arm is def no longer up, no longer listening for commands');
        //     // }, commandListenerInitiatorObject.timerAmount);
        // }








        // turns out all this code is alright - there is a 500ms (~) delay between 'stop listeing for command'
        // and 'listen for command' - but it does not matter because we're using a different timer. the timer
        // here deserves to be called 'armIsUp', and it will affect listening for commands (and nothing else
        // should).
        // when we get the (right now) 'listen for command', it will start or restart a timer of 700ms
        // to listen for commands. Every time. When we get a (right now) 'stop listening for command', it
        // does nothing - time will take care of the rest.
        if (gesture.commandListenInitiator) {
            // we'd put the state in here - like 'armsUp[gesture.something] = true
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
                    if (commandListenerInitiatorObject.hitRateSuccess > commandListenerInitiatorObject.hitRate / 2) {
                        // this.handleGestureAction(gesture);
                        // this.listenForCommandAgainIfNecess();
                        this.gestureState.listeningForCommand = true;
                        console.log('listening for commands');
                        this.gestureState.shouldRenameOneTimeGestureHasBeenCalledMoreRecentlyThanShouldListenForCommandsEvent = false;
                    }
                    commandListenerInitiatorObject.hitRateSuccess = 0;
                    commandListenerInitiatorObject.hitRate = 0;

                    // We call this even if we're not listening for commands
                    this.doSomeTimer();
                }, commandListenerInitiatorObject.timerAmount);
            }

            // Ok so we're listening for a command, we don't care at all about the timer
            // after we start (and it's gone), we instead care about another timer.
            commandListenerInitiatorObject.hitRateSuccess++;
        }


        /*
            when we swing the arm to the right, the arm is no longer 'up'.
            but let's assume that the arm can be up as well until we get
            facial recognition.
            so the 700ms timer wants to go on, but it's killed.
            we start a new timer of maybe a second. this timer says
            'ok cool i'm issuing this type of command and not listening
            to anything else you're doing for a second.'
            but it will still be looking for an arm up. because we want it
            to go right back to blue if we want to.
         */

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
            // if (gesture.type === 'scale') {
            //     if (this.gestureState.listeningForCommand) {
            //         console.log('listening for scale gesture');
            //     }
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
    }

    private doSomeTimer() {
        // if at any point in 500ms we decide the arm is up, this is called.
        // it is the only thing that will make listening for command false.
        // note that listeningForCommand is tied to two different timers! by design.

        // console.log('do some timer');
        clearTimeout(this.timers.commandListenerTimer);
        this.timers.commandListenerTimer = setTimeout(() => {
            console.log('stop listening to commands');
            this.timers.commandListenerTimer = null;
            this.gestureState.listeningForCommand = false;
        }, this.gestureState.timeRelative.commandListener.timerAmount);
    }

    // private stopListeningForCommand() {
    //     console.log('stop listening for command');
    //     this.gestureState.listeningForCommand = false;
    // }

    private doesPoseSatisfyGesture(gesture: OttoGesture, pose: PoseData) {

        // console.log('does pose satisfy');
        let rulesAsArray = (<any>Object).values(gesture.rules);
        let keypointsWithHighEnoughScore: {
            [part: string]: PoseDataKeypoint
        } = {};
        let matchingRuleCount = 0;

        // Find the keypoints in this pose that have a high enough confidence
        for (let kp of pose.keypoints) {
            if (rulesAsArray.find(t => t.part === kp.part)) {
                // let minPartConfidence = this.variableState.multiPoseDetection.minPartConfidence;
                let minPartConfidence = 0.1; // TODO - Part score
                if (kp.score > minPartConfidence) {
                    keypointsWithHighEnoughScore[kp.part] = kp;
                }
            }
        }

        // If we've got the same amount of keypoints with high enough score as the amount of rules (which are for each part)
        if (Object.keys(keypointsWithHighEnoughScore).length === rulesAsArray.length) {
            // Here we're confident about where the body parts are - now we see if they match the rules
            for (let part in keypointsWithHighEnoughScore) {
                const kp = keypointsWithHighEnoughScore[part];
                const rule = gesture.rules[kp.part];
                // @ts-ignore
                let relativeToKeypoint = pose.keypoints.find(p => p.part === rule.partRelativeTo);
                if (relativeToKeypoint) {

                    // here

                    // if (rule.distance) {
                    //     let matched = false;
                    //     if (rule.distance.x) {
                    //         matched = checkDistanceMatch('x', rule, kp, relativeToKeypoint, imgWidth);
                    //     }
                    //     if (rule.distance.y) {
                    //         matched = checkDistanceMatch('y', rule, kp, relativeToKeypoint, imgHeight);
                    //     }
                    //     if (!matched) {
                    //         break;
                    //     } else {
                    //         matchingRuleCount++;
                    //     }
                    // }

                    // doAngle(goodKeypoints[part], relativeToKeypoint);
                    let degree = this.recordAngle(rule, keypointsWithHighEnoughScore[part], relativeToKeypoint);

                    if (degree > rule.angle.degreeFrom && degree < rule.angle.degreeTo) {
                        matchingRuleCount++;
                    } else {
                        break;
                    }
                }
            }
        }

        // console.log('poses matches? ', matchingRuleCount === rulesAsArray.length);
        return matchingRuleCount === rulesAsArray.length;
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
        return deg;
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
}

export const ottoGestureAnalysis = new OttoGestureAnalysis();