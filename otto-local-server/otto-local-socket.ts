import { ottoGestureAnalysis } from './otto-gesture-analysis';

declare const require;

const socketIo = require('socket.io');

class OttoLocalSocket {

    browserSockets: any = {};
    posenet: any;
    guiState = {
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
    tf: any;

    constructor() {}

    init(http: any, posenet: any, tf: any) {
        this.tf = tf;
        this.posenet = posenet;
        let io = socketIo(http);
        io.on('connection', socket => {

            socket.on('browser', () => {
                console.log('browser connected');
                this.browserSockets[socket.id] = socket;

                socket.on('guiState', state => {
                    console.log('got gui state, changing it');
                    this.guiState = state;
                });

                socket.emit('guiState', this.guiState);
            });

            socket.on('satellite', () => {
                console.log('satellite connected');
                socket.on('image', this.onImage.bind(this));
            });

            socket.on('disconnect', () => {
               const s = this.browserSockets[socket.id];
               if (s) {
                   console.log('removing browser socket');
                   delete this.browserSockets[socket.id];
               } else {
                   console.log('something went wrong removing the browser socket');
               }
            });

        });
    }

    onImage(posenetInstance: any, image: any) {
        console.log('got image');
        ottoGestureAnalysis.analyze(image, this.tf, this.posenet, posenetInstance, this.guiState, (data) => {
            for (let key in this.browserSockets) {
                const browserSocket = this.browserSockets[key];
                browserSocket.emit('data', {
                    image: image,
                    data: data // data is [score and keypoints]
                });
            }
        });
    }

}

export const ottoLocalSocket = new OttoLocalSocket();
