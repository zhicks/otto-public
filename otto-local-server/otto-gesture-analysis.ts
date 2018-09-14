const Canvas = require('canvas-prebuilt');
const Image = Canvas.Image;

declare const require;

class OttoGestureAnalysis {

    analyze(imageData: any, tf: any, posenet: any, posenetInstance: any, guiState: any, callback: Function) {
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
        const modelOutputs = posenetInstance.predictForMultiPose(input, guiState.outputStride);
        let poseAnalysis = posenet.decodeMultiplePoses(
            modelOutputs.heatmapScores, modelOutputs.offsets,
            modelOutputs.displacementFwd, modelOutputs.displacementBwd,
            guiState.outputStride, guiState.multiPoseDetection.maxDetections,
            guiState.multiPoseDetection);

        console.log('image size is', img.width, img.height);

        poseAnalysis.then(function(keypointsAndScores) {
            // console.log(arguments);
            console.log('that took about (in ms):', Date.now() - now1);

            keypointsAndScores.forEach(k => {
                console.log('score is', k.score);
            });

            callback(keypointsAndScores);
        });
    }

}

export const ottoGestureAnalysis = new OttoGestureAnalysis();