const Canvas = require('canvas-prebuilt');
const Image = Canvas.Image;

declare const require;

class OttoSomething {

    analyze(imageData: any, tf: any, posenet: any, posenetInstance: any, guiState: any, callback: Function) {
        let now1 = Date.now();
        console.log('analyzing');
        const img = new Image();
        img.src = imageData;
        const canvas = new Canvas(img.width, img.height);
        const context = canvas.getContext('2d');
        console.log('image size is', img.width, img.height);
        context.drawImage(img, 0, 0, img.width, img.height);
        const input = tf.fromPixels(canvas);
        console.log('analyize');
        const modelOutputs = posenetInstance.predictForMultiPose(input, guiState.outputStride);
        let poseAnalysis = posenet.decodeMultiplePoses(
            modelOutputs.heatmapScores, modelOutputs.offsets,
            modelOutputs.displacementFwd, modelOutputs.displacementBwd,
            guiState.outputStride, guiState.multiPoseDetection.maxDetections,
            guiState.multiPoseDetection);

        poseAnalysis.then(function(keypointsAndScores) {
            // console.log(arguments);
            let now2 = Date.now();
            console.log('that took about (in ms):', now2 - now1);
            keypointsAndScores.forEach(k => {
                console.log('score is', k.score);
            });
            console.log('for now, using first');

            callback(keypointsAndScores[0]);
        });


    }

}

export const ottoSomething = new OttoSomething();