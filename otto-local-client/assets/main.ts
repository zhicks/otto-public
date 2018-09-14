declare const io;
declare const $;
// import * as posenet from '@tensorflow-models/posenet';

import * as posenet from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs';
import dat from 'dat.gui';

console.log('wat');
let $canvas;
let canvasContext;

const color = 'aqua';

let guiState = {
    outputStride: 16,
    multiPoseDetection: {
        minPartConfidence: 0.5,
        minPoseConfidence: 0.5,
        scoreThreshold: 0.5,
        nmsRadius: 20.0,
        maxDetections: 15,
    },
    showKeypoints: true,
    showSkeleton: true
};
let gui;

function setupGui() {

    gui = new dat.GUI();
    // Output stride:  Internally, this parameter affects the height and width of
    // the layers in the neural network. The lower the value of the output stride
    // the higher the accuracy but slower the speed, the higher the value the
    // faster the speed but lower the accuracy.
    gui.add(guiState, 'outputStride', [8, 16, 32]).onChange((outputStride) => {
        guiState.outputStride = +outputStride;
        sendGuiStateToServer();
    });

    // Pose confidence: the overall confidence in the estimation of a person's
    // pose (i.e. a person detected in a frame)
    // Min part confidence: the confidence that a particular estimated keypoint
    // position is accurate (i.e. the elbow's position)
    const multiPoseDetection = gui.addFolder('Multi Pose Estimation');
    multiPoseDetection.open();
    multiPoseDetection
        .add(guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0)
        .onChange(sendGuiStateToServer);
    multiPoseDetection
        .add(guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0)
        .onChange(sendGuiStateToServer);

    // nms Radius: controls the minimum distance between poses that are returned
    // defaults to 20, which is probably fine for most use cases
    multiPoseDetection.add(guiState.multiPoseDetection, 'nmsRadius', 0.0, 40.0)
        .onChange(sendGuiStateToServer);
    multiPoseDetection.add(guiState.multiPoseDetection, 'maxDetections')
        .min(1)
        .max(20)
        .step(1)
        .onChange(sendGuiStateToServer);

    gui.add(guiState, 'showKeypoints').onChange(sendGuiStateToServer);
    gui.add(guiState, 'showSkeleton').onChange(sendGuiStateToServer);

    // multiPoseDetection.open();
    console.log('should we multi pose detection open?');
}

const socket = io();

socket.on('guiState', (state) => {
    console.log('updating gui state');
    for (let key in state) {
        if (typeof state[key] === 'object') {
            for (let key2 in state[key]) {
                guiState[key][key2] = state[key][key2];
            }
        } else {
            guiState[key] = state[key];
        }
    }
    // guiState = state;
    for (var i in gui.__controllers) {
        gui.__controllers[i].updateDisplay();
    }
});

function sendGuiStateToServer() {
    socket.emit('guiState', guiState);
}

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
            // renderImageToCanvas(image, [513, 513], canvas); ????
            canvasContext.drawImage(img, 0, 0, 513, 513);
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
    poses.forEach((pose) => {
        if (pose.score >= minPoseConfidence) {
            if (guiState.showKeypoints) {
                drawKeypoints(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
            }

            if (guiState.showSkeleton) {
                drawSkeleton(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
            }
        }
    });
}

function toTuple({y, x}) {
    return [y, x];
}

function drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
    const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
        keypoints, minConfidence);

    adjacentKeyPoints.forEach((keypoints) => {
        drawSegment(toTuple(keypoints[0].position), toTuple(keypoints[1].position), color, scale, ctx);
    });
}

function drawSegment([ay, ax]: any, [by, bx]: any, color, scale, ctx) {
    const lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax * scale, ay * scale);
    ctx.lineTo(bx * scale, by * scale);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
}

export async function renderToCanvas(a, ctx) {
    const [height, width] = a.shape;
    const imageData = new ImageData(width, height);

    const data = await a.data();

    for (let i = 0; i < height * width; ++i) {
        const j = i * 4;
        const k = i * 3;

        imageData.data[j + 0] = data[k + 0];
        imageData.data[j + 1] = data[k + 1];
        imageData.data[j + 2] = data[k + 2];
        imageData.data[j + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Draw an image on a canvas
 */
export function renderImageToCanvas(image, size, canvas) {
    canvas.width = size[0];
    canvas.height = size[1];
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
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
    setupGui();
    socket.emit('browser');
});