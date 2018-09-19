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

interface OttoGestureRuleDistanceRequirement {
    noMoreThan?: {
        value: number,
        units: string
    }
}

interface OttoGestureRule {
    // Keyed on part.part
    part: PoseDataKeypoint,
    partRelativeTo: PoseDataKeypoint,
    distance: {
        x?: OttoGestureRuleDistanceRequirement,
        y?: OttoGestureRuleDistanceRequirement
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

    gestureState = {
        // ruleNames: [],
        armsUp: {
            left: false,
            right: false
        },
        oneTimeCommandIndicator: false,
        listeningForCommand: false,
        timeRelative: {
            commandListenInitiator: {
                hitRate: 0,
                hitRateSuccess: 0,
                timer: null,
                timerAmount: 500
            },
            commandListener: {
                timer: null,
                timerAmount: 700,
                oneTimeCommandTimerForVisualPurposes: null,
                oneTimeCommandTimerForVisualPurposesAmount: 1000
            }
        }
        // lightState: {
        //
        // }
    }

    changeVariableState(state: any) {
        this.variableState = state;
    }


    analyzeGestures(poses: PoseData[]) {

        this.gestureState.timeRelative.commandListenInitiator.hitRate++;

        gestures.forEach(gesture => {

            poses.forEach(pose => {

                const doesMatch = this.doesPoseSatisfyGesture(gesture, pose);
                if (doesMatch) {
                    this.handleGestureMatch(gesture);
                }

            });

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

        if (gesture.commandListenInitiator) {
            // we'd put the state in here - like 'armsUp[gesture.something] = true
            this.gestureState.armsUp[gesture.commandListenInitiator.arm] = true;
            let commandListenerInitiatorObject = this.gestureState.timeRelative.commandListenInitiator;

            // If we're already listening for a command, there's another timer that will set
            // it to not listening anymore. We only care about the timer to determine that
            // we should listen.
            if (!this.gestureState.listeningForCommand && !commandListenerInitiatorObject.timer) {
                console.log('starting timer for command listener initiator');
                commandListenerInitiatorObject.timer = setTimeout(() => {
                    console.log('expiring this timeout for command listener initiator');
                    this.clearTimeout(commandListenerInitiatorObject, 'timer');
                    if (!this.gestureState.listeningForCommand) {
                        if (commandListenerInitiatorObject.hitRateSuccess > commandListenerInitiatorObject.hitRate / 2) {
                            // this.handleGestureAction(gesture);
                            this.listenForCommand();
                        }
                    }
                    commandListenerInitiatorObject.hitRateSuccess = 0;
                    commandListenerInitiatorObject.hitRate = 0;
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

        let commandListenerObject = this.gestureState.timeRelative.commandListener;
        if (gesture.type === 'one time') {
            this.stopListeningForCommand();
            this.gestureState.oneTimeCommandIndicator = true;
            commandListenerObject.oneTimeCommandTimerForVisualPurposes = setTimeout(() => {
                console.log('clearing blocked timer');
                this.clearTimeout(commandListenerObject, 'oneTimeCommandTimerForVisualPurposes');
                if (!this.gestureState.listeningForCommand) {
                    this.gestureState.oneTimeCommandIndicator = false;
                }
            }, commandListenerObject.oneTimeCommandTimerForVisualPurposesAmount); // This is just for display purposes
            this.doGestureAction(gesture);
        }

        /*
            now when we do volume control - we check to see if it's blue,
            and if it is, we're keeping a close eye on the position and
            angle of the elbow to wrist. it needs to be 'arm is up' (according
            to that timer up there). each frame needs to be within one
            quarter of the height of their elbow to wrist distance and the
            angle needs to be decreasing maybe.
         */
        if (gesture.type === 'scale') {
            if (this.gestureState.listeningForCommand) {
                console.log('listening for scale gesture');
            }
        }

    }

    private listenForCommand() {
        // easy. when it lands, we don't care about that timer anymore.
        // we want the light to stay on as long as the arm is up.
        //     so the new timer here is one, say 700ms, that gets reset
        // every time we get a new 'arm is up.' when the arm goes down,
        //     that 700ms will expire and the light goes off.
        //     this is also the same timer that, if active, means the
        // we're listening for a command, and so the switch and volume
        // controls depend on this timer.
        this.gestureState.listeningForCommand = true;
        let commandListenerObject = this.gestureState.timeRelative.commandListener;
        this.clearTimeout(commandListenerObject, 'timer');
        commandListenerObject.timer = setTimeout(() => {
            console.log('command listener timeout, clearing');
            this.stopListeningForCommand();
        }, commandListenerObject.timerAmount);
    }

    private doGestureAction(gesture: OttoGesture) {
        console.log('doing gesture ', gesture.name);
    }

    private stopListeningForCommand() {
        this.gestureState.listeningForCommand = false;
    }

    private clearTimeout(timeoutObj: any, timeoutVar: string) {
        clearTimeout(timeoutObj[timeoutVar]);
        timeoutObj[timeoutVar] = null;
    }

    private doesPoseSatisfyGesture(gesture: OttoGesture, pose: PoseData) {

        let rulesAsArray = (<any>Object).values(gesture.rules);
        let keypointsWithHighEnoughScore: {
            [part: string]: PoseDataKeypoint
        } = {};

        // Find the keypoints in this pose that have a high enough confidence
        for (let kp of pose.keypoints) {
            if (rulesAsArray.find(t => t.part === kp.part)) {
                if (kp.score > this.variableState.multiPoseDetection.minPartConfidence) {
                    keypointsWithHighEnoughScore[kp.part] = kp;
                }
            }
        }

        // If we've got the same amount of keypoints with high enough score as the amount of rules (which are for each part)
        if (Object.keys(keypointsWithHighEnoughScore).length === rulesAsArray.length) {
            // Here we're confident about where the body parts are - now we see if they match the rules
            let matchingRuleCount = 0;
            for (let part in keypointsWithHighEnoughScore) {
                const kp = keypointsWithHighEnoughScore[part];
                const rule = gesture.rules[kp.part];
                // @ts-ignore
                let relativeToKeypoint = pose.keypoints.find(p => p.part === rule.partRelativeTo.part);
                if (relativeToKeypoint) {
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

                    // assume match for now
                    return true;
                }
            }
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
}

export const ottoGestureAnalysis = new OttoGestureAnalysis();