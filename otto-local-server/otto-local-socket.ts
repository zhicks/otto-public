import { ottoSomething } from "./otto-something";

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
            console.log('got connection socket id is ', socket.id);
            // socket.on('hi', () => {
            //     socket.emit('test', 'boop');
            // });
            // socket.on('disconnect', () => {
            //     console.log('socket disconnected');
            // });
            socket.on('browser', () => {
                console.log('browser connected');
                this.browserSockets[socket.id] = socket;
                socket.emit('guiState', this.guiState);
                socket.on('guiState', state => {
                   this.guiState = state;
                });
            });
            socket.on('satellite', () => {
                console.log('satellite connected');
                socket.on('image', this.asdf.bind(this));
            });
            socket.on('disconnect', () => {
               console.log('trying to remove socket');
               const s = this.browserSockets[socket.id];
               if (s) {
                   console.log('removing browser socket');
                   delete this.browserSockets[socket.id];
               }
            });
        });
    }

    asdf(posenetInstance: any, image: any) {
        console.log('got image');
        // convert to buffer
        // do analyze
        // send to browser
        ottoSomething.analyze(image, this.tf, this.posenet, posenetInstance, this.guiState, (data) => {
            for (let key in this.browserSockets) {
                const browserSocket = this.browserSockets[key];
                browserSocket.emit('data', {
                    image: image,
                    // data is score and keypoints
                    data: data
                });
            }
        });
    }

}

export const ottoLocalSocket = new OttoLocalSocket();
