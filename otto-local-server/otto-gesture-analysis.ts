const Canvas = require('canvas-prebuilt');
const Image = Canvas.Image;

declare const require;

export interface PoseKeypoint {
    part: 'nose' | 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'leftShoulder' | 'rightShoulder' |
          'leftElbow' | 'rightElbow' | 'leftWrist' | 'rightWrist' | 'leftHip' | 'rightHip' | 'leftKnee' |
          'rightKnee' | 'leftAnkle' | 'rightAnkle'
    position: {
        x: number,
        y: number
    },
    score: number
}

export interface Pose {
    keypoints: PoseKeypoint[];
    score: number;
}

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

        poseAnalysis.then((keypointsAndScores: Pose[]) => {
            // console.log(arguments);
            console.log('that took about (in ms):', Date.now() - now1);

            keypointsAndScores.forEach(k => {
                console.log('score is', k.score);
            });

            callback(keypointsAndScores);
        });
    }


    analyzeGestures(data: Pose[], callback: Function) {

    }
}

export const ottoGestureAnalysis = new OttoGestureAnalysis();