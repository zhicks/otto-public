declare const io;
declare const $;
// import * as posenet from '@tensorflow-models/posenet';

console.log('wat');
let $canvas;
let canvasContext;

const color = 'aqua';

const guiState = {
    outputStride: 16,
    singlePoseDetection: {
        minPartConfidence: 0.5,
        minPoseConfidence: 0.5,
    },
    multiPoseDetection: {
        minPartConfidence: 0.5,
        minPoseConfidence: 0.5,
        scoreThreshold: 0.5,
        nmsRadius: 20.0,
        maxDetections: 15,
    },
    showKeypoints: true,
    showSkeleton: true,
    showBoundingBox: false,
    visualizeOutputs: {
        part: 0,
        showHeatmap: false,
        showOffsets: false,
        showDisplacements: false,
    },
};

const socket = io();

socket.emit('browser', () => {

});

socket.on('test', (msg) => {
    console.log('test', msg);
});

let q = false;
socket.on('data', (msg: { image: any, data: { keypoints: { score: number, part: string, position: { x: number, y: number } }[], score: number } }) => {
    console.log(msg);
    if (canvasContext) {
        let image = msg.image;
        var arrayBufferView = new Uint8Array( image );
        var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
        var imageUrl = URL.createObjectURL( blob );
        var img = new Image;
        img.src = imageUrl;
        // Need to dipose of the points!
        img.onload = function(){
            // ctx.drawImage(img,0,0); // Or at whatever offset you like
            if (!q) {
                canvasContext.drawImage(img, 0, 0, 513, 513);
                q = true;
            }
        };
        $('#imggg')[0].src=img.src;

        // -------------------------------------------------------------------

        let canvas = $canvas[0];
        drawResults(
            canvas, msg.data, guiState.multiPoseDetection.minPartConfidence,
            guiState.multiPoseDetection.minPoseConfidence);

        // const {part, showHeatmap, showOffsets, showDisplacements} =
        //     guiState.visualizeOutputs;
        // const partId = +part;
        //
        // visualizeOutputs(
        //     partId, showHeatmap, showOffsets, showDisplacements,
        //     canvas.getContext('2d'));


        // -------------------------------------------------------------------

    }
});

function drawResults(canvas, poses, minPartConfidence, minPoseConfidence) {
    // drawKeypoints(
    //     poses, minPartConfidence, canvas.getContext('2d'));
    // drawKeypoints(
    //     pose.keypoints, minPartConfidence, canvas.getContext('2d'));
    // drawSkeleton(
    //     pose.keypoints, minPartConfidence, canvas.getContext('2d'));
    poses.forEach((pose) => {
        if (pose.score >= minPoseConfidence) {
            if (guiState.showKeypoints) {
                drawKeypoints(
                    pose.keypoints, minPartConfidence, canvas.getContext('2d'));
            }

            // if (guiState.showSkeleton) {
            //     drawSkeleton(
            //         pose.keypoints, minPartConfidence, canvas.getContext('2d'));
            // }
            //
            // if (guiState.showBoundingBox) {
            //     drawBoundingBox(pose.keypoints, canvas.getContext('2d'));
            // }
        }
    });
}

// function visualizeOutputs(partId, drawHeatmaps, drawOffsetVectors, drawDisplacements, ctx) {
//
//     const {heatmapScores, offsets, displacementFwd, displacementBwd} =
//         modelOutputs;
//     const outputStride = +guiState.outputStride;
//
//     const [height, width] = heatmapScores.shape;
//
//     ctx.globalAlpha = 0;
//     for (let y = 0; y < height; y++) {
//         for (let x = 0; x < width; x++) {
//             const score = heatmapScores.get(y, x, partId);
//
//             // to save on performance, don't draw anything with a low score.
//             if (score < 0.05) continue;
//
//             // set opacity of drawn elements based on the score
//             ctx.globalAlpha = score;
//
//             if (drawHeatmaps) {
//                 drawPoint(ctx, y * outputStride, x * outputStride, 2, 'yellow');
//             }
//
//             const offsetsVectorY = offsets.get(y, x, partId);
//             const offsetsVectorX = offsets.get(y, x, partId + 17);
//
//             if (drawOffsetVectors) {
//                 drawOffsetVector(
//                     ctx, y, x, outputStride, offsetsVectorY, offsetsVectorX);
//             }
//
//             if (drawDisplacements) {
//                 // exponentially affect the alpha of the displacements;
//                 ctx.globalAlpha *= score;
//
//                 drawDisplacementEdgesFrom(
//                     ctx, partId, displacementFwd, outputStride, parentToChildEdges, y,
//                     x, offsetsVectorY, offsetsVectorX);
//
//                 drawDisplacementEdgesFrom(
//                     ctx, partId, displacementBwd, outputStride, childToParentEdges, y,
//                     x, offsetsVectorY, offsetsVectorX);
//             }
//         }
//
//         ctx.globalAlpha = 1;
//     }
//
// }

function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
    for (let i = 0; i < keypoints.length; i++) {
        const keypoint = keypoints[i];

        if (keypoint.score < minConfidence) {
            continue;
        }

        const {y, x} = keypoint.position;
        drawPoint(ctx, y * scale, x * scale, 3, color);
    }
}

function drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

// function drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
//     const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
//         keypoints, minConfidence);
//
//     adjacentKeyPoints.forEach((keypoints) => {
//         drawSegment(toTuple(keypoints[0].position),
//             toTuple(keypoints[1].position), color, scale, ctx);
//     });
// }

$(document).ready(() => {
    $canvas = $('#maincanvas');
    // $canvas.width(513);
    // $canvas.height(513);
    $canvas[0].width = 513;
    $canvas[0].height = 513;
    canvasContext = $canvas[0].getContext('2d');
});