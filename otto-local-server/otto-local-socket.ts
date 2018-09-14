import { ottoGestureAnalysis, Pose } from './otto-gesture-analysis';

declare const require;

const socketIo = require('socket.io');

class OttoLocalSocket {

    browserSockets: any = {};
    posenet: any;
    tf: any;
    posenetLocalInstance: any;

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
                    ottoGestureAnalysis.changeVariableState(state);
                });

                socket.emit('guiState', ottoGestureAnalysis.variableState);
            });

            socket.on('satellite', () => {
                console.log('satellite connected');
                socket.on('image', image => {
                    if (this.posenetLocalInstance) {
                        this.onImage(image);
                    }
                });
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

    onImage(image: any) {
        console.log('got image');
        ottoGestureAnalysis.posenetAnalyze(image, this.tf, this.posenet, this.posenetLocalInstance, (data: Pose[]) => {
            // If there are browsers open, send em this data
            for (let key in this.browserSockets) {
                const browserSocket = this.browserSockets[key];
                browserSocket.emit('data', {
                    image: image,
                    data: data
                });
            }

            // Detect gestures
            ottoGestureAnalysis.analyzeGestures(data, (someKindOfData => {
                for (let key in this.browserSockets) {
                    const browserSocket = this.browserSockets[key];
                    browserSocket.emit('something', someKindOfData)
                }
            }));
        });
    }

    setPosenetLocalInstance(net: any) {
        this.posenetLocalInstance = net;
    }
}

export const ottoLocalSocket = new OttoLocalSocket();
