const Canvas = require('canvas-prebuilt');
const Image = Canvas.Image;

declare const require;

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

type PoseDataPart = 'nose' | 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'leftShoulder' | 'rightShoulder' |
    'leftElbow' | 'rightElbow' | 'leftWrist' | 'rightWrist' | 'leftHip' | 'rightHip' | 'leftKnee' |
    'rightKnee' | 'leftAnkle' | 'rightAnkle';

export interface PoseDataKeypoint {
    part: PoseDataPart,
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
    part: PoseDataKeypoint, // Also keyed on this
    partRelativeTo: PoseDataKeypoint,
    distance: {
        x?: OttoGestureRuleDistanceRequirement,
        y?: OttoGestureRuleDistanceRequirement
    }
}

interface OttoGestureInfo {
    successText: string,
    showInBrowserOnSuccess: string,
    action: any,
    something: {

    }
    requirement: {

    }
}

class OttoGesture {
    constructor(
        public info: OttoGestureInfo
    ) {}
}

const gestureInfo: OttoGestureInfo[] = [

];
const gestures = gestureInfo.map(i => new OttoGesture(i));

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

    changeVariableState(state: any) {
        this.variableState = state;
    }

    posenetAnalyze(imageData: any, tf: any, posenet: any, posenetInstance: any, callback: Function) {
        const now1 = Date.now();
        console.log('analyzing');

        // Image / canvas creation
        const img = new Image();
        img.src = imageData;
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

            // keypointsAndScores.forEach(k => {
            //     console.log('score is', k.score);
            // });

            callback({
                poses: keypointsAndScores,
                imgDims: {
                    w: img.width,
                    h: img.height
                }
            });
        });
    }


    analyzeGestures(poses: PoseData[], imgWidth: number, imgHeight: number, callback: Function) {
        let someKindOfData = null;
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

        callback(someKindOfData);
    }

    private checkDistanceMatch(direction: string, rule: OttoGestureRule, kp: PoseDataKeypoint,
                               relativeToKeypoint: PoseDataKeypoint, compareTo: number) {
        if (rule.distance[direction].noMoreThan) {
            let diff = Math.abs(kp.position[direction] - relativeToKeypoint.position[direction]);
            if (rule.distance[direction].noMoreThan.units === '%') {
                let pct = (diff / compareTo) * 100;
                if (pct < rule.distance[direction].noMoreThan.value) {
                    // We have a match
                    console.log('We have a match with ', kp.part);
                    return true;
                }
            }
        }
        return false;
    }
}

export const ottoGestureAnalysis = new OttoGestureAnalysis();