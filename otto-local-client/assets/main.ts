declare const io;
declare const $;

declare const posenet;
declare const dat;

let socketHandler: SocketHandler;
let drawHandler: DrawHandler;
let domHandler: DomHandler;

class SocketHandler {
    socket: any;

    init() {
        const socket = this.socket = io();

        socket.on('guiState', (state) => {
            domHandler.updateGuiStateFromSocket(state);
        });

        socket.on('data', (msg) => {
            domHandler.onData(msg);
        });

        socket.emit('browser');
    }
}

class DrawHandler {
    color = 'aqua';

    drawResults(canvas, poses, minPartConfidence, minPoseConfidence) {
        poses.forEach((pose) => {
            if (pose.score >= minPoseConfidence) {
                if (domHandler.guiState.showKeypoints) {
                    this.drawKeypoints(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
                }

                if (domHandler.guiState.showSkeleton) {
                    this.drawSkeleton(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
                }
            }
        });
    }

    drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
        const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
            keypoints, minConfidence);

        adjacentKeyPoints.forEach((keypoints) => {
            this.drawSegment(this.toTuple(keypoints[0].position), this.toTuple(keypoints[1].position), this.color, scale, ctx);
        });
    }

    drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
        for (let i = 0; i < keypoints.length; i++) {
            const keypoint = keypoints[i];

            if (keypoint.score < minConfidence) {
                continue;
            }

            const {y, x} = keypoint.position;
            this.drawPoint(ctx, y * scale, x * scale, 3, this.color);
        }
    }

    drawPoint(ctx, y, x, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    drawSegment([ay, ax]: any, [by, bx]: any, color, scale, ctx) {
        const lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax * scale, ay * scale);
        ctx.lineTo(bx * scale, by * scale);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    toTuple({y, x}) {
        return [y, x];
    }

}

class DomHandler {

    $canvas: any;
    canvasContext: any;
    gui: any;
    guiState = {
        multiPoseDetection: {
            outputStride: 16,
            minPartConfidence: 0.1,
            minPoseConfidence: 0.1,
            scoreThreshold: 0.1,
            nmsRadius: 1.0,
            maxDetections: 1,
        },
        showKeypoints: false,
        showSkeleton: false
    }

    init() {
        this.$canvas = $('#maincanvas');
        this.$canvas[0].width = 513;
        this.$canvas[0].height = 513;
        this.canvasContext = this.$canvas[0].getContext('2d');
        this.setupGui();
    }

    onData(msg: { image: any, data: { keypoints: { score: number, part: string, position: { x: number, y: number } }[], score: number } }) {
        console.log(msg);
        let image = msg.image;
        let arrayBufferView = new Uint8Array( image );
        let blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
        let imageUrl = URL.createObjectURL( blob );
        let img = new Image;
        img.src = imageUrl;
        img.onload = () => {
            this.canvasContext.drawImage(img, 0, 0, 513, 513);
            drawHandler.drawResults(this.$canvas[0], msg.data, this.guiState.multiPoseDetection.minPartConfidence, this.guiState.multiPoseDetection.minPoseConfidence);
        };
    }
    setupGui() {
        const gui = this.gui = new dat.GUI();
        // Output stride:  Internally, this parameter affects the height and width of
        // the layers in the neural network. The lower the value of the output stride
        // the higher the accuracy but slower the speed, the higher the value the
        // faster the speed but lower the accuracy.
        const multiPoseDetection = gui.addFolder('Pose Estimation');
        multiPoseDetection.open();

        multiPoseDetection.add(this.guiState.multiPoseDetection, 'outputStride', [8, 16, 32]).onChange((outputStride) => {
            this.guiState.multiPoseDetection.outputStride = +outputStride;
            this.sendGuiStateToServer();
        });

        // Pose confidence: the overall confidence in the estimation of a person's
        // pose (i.e. a person detected in a frame)
        // Min part confidence: the confidence that a particular estimated keypoint
        // position is accurate (i.e. the elbow's position)
        multiPoseDetection
            .add(this.guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0)
            .onChange(this.sendGuiStateToServer.bind(this));
        multiPoseDetection
            .add(this.guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0)
            .onChange(this.sendGuiStateToServer.bind(this));

        // nms Radius: controls the minimum distance between poses that are returned
        // defaults to 20, which is probably fine for most use cases
        multiPoseDetection.add(this.guiState.multiPoseDetection, 'nmsRadius', 0.0, 40.0)
            .onChange(this.sendGuiStateToServer.bind(this));
        multiPoseDetection.add(this.guiState.multiPoseDetection, 'maxDetections')
            .min(1)
            .max(20)
            .step(1)
            .onChange(this.sendGuiStateToServer.bind(this));

        const visual = gui.addFolder('Visual');
        visual.open();

        visual.add(this.guiState, 'showKeypoints').onChange(this.sendGuiStateToServer.bind(this));
        visual.add(this.guiState, 'showSkeleton').onChange(this.sendGuiStateToServer.bind(this));
    }

    updateGuiStateFromSocket(state: any) {
        console.log('updating gui state');
        for (let key in state) {
            if (typeof state[key] === 'object') {
                for (let key2 in state[key]) {
                    this.guiState[key][key2] = state[key][key2];
                }
            } else {
                this.guiState[key] = state[key];
            }
        }
        // Top level
        for (let i in domHandler.gui.__controllers) {
            this.gui.__controllers[i].updateDisplay();
        }
        // Folders
        for (let i in domHandler.gui.__folders) {
            for (let j in domHandler.gui.__folders[i].__controllers) {
                domHandler.gui.__folders[i].__controllers[j].updateDisplay();
            }
        }
        // Why is dat.gui like this
    }

    private sendGuiStateToServer() {
        socketHandler.socket.emit('guiState', this.guiState);
    }
}

socketHandler = new SocketHandler();
drawHandler = new DrawHandler();
domHandler = new DomHandler();

$(document).ready(() => {
    domHandler.init();
    socketHandler.init();
});


// ------------------------------------------------------------------- ???????????
// export async function renderToCanvas(a, ctx) {
//     const [height, width] = a.shape;
//     const imageData = new ImageData(width, height);
//     const data = await a.data();
//     for (let i = 0; i < height * width; ++i) {
//         const j = i * 4;
//         const k = i * 3;
//         imageData.data[j + 0] = data[k + 0];
//         imageData.data[j + 1] = data[k + 1];
//         imageData.data[j + 2] = data[k + 2];
//         imageData.data[j + 3] = 255;
//     }
//     ctx.putImageData(imageData, 0, 0);
// }
//
// function renderImageToCanvas(image, size, canvas) {
//     canvas.width = size[0];
//     canvas.height = size[1];
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(image, 0, 0);
// }
//
