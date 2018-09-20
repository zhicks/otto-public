import { ottoGestureAnalysis, PoseData } from './otto-gesture-analysis';

declare const require;

const fs = require('fs');
const socketIo = require('socket.io');

class OttoLocalSocket {

    browserSockets: any = {};
    posenet: any;
    tf: any;
    posenetLocalInstance: any;
    tempSocket;

    constructor() {}

    init(http: any, posenet: any, tf: any) {
        this.tf = tf;
        this.posenet = posenet;
        let io = socketIo(http);
        io.on('connection', socket => {
            console.log('io on connection');

            // this.browserSockets[socket.id] = socket; // temp!
            this.tempSocket = socket;
            socket.on('tempOnData', this.tempOnData.bind(this));

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
                    console.log('on image hi');
                    if (this.posenetLocalInstance) {
                        this.onImage(image);
                    }
                });
            });

            socket.on('disconnect', () => {
                // TODO - This isn't right
                console.log('socket on disconnect');
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
        // console.log(image);
        // fs.writeFileSync('imgtest.txt', image);
        ottoGestureAnalysis.posenetAnalyze(image, this.tf, this.posenet, this.posenetLocalInstance, (data: { poses: PoseData[], img: any, imgDims: { w: number, h: number }}) => {
            // If there are browsers open, send em this data
            for (let key in this.browserSockets) {
                const browserSocket = this.browserSockets[key];
                browserSocket.emit('data', {
                    // image: data.img,
                    data: data
                });
            }

            // Detect gestures
            // ottoGestureAnalysis.analyzeGestures(data.poses, data.imgDims.w, data.imgDims.h, (someKindOfData => {
            //     if (someKindOfData) {
            //         for (let key in this.browserSockets) {
            //             const browserSocket = this.browserSockets[key];
            //             browserSocket.emit('something', someKindOfData)
            //         }
            //     }
            // }));
        });
    }

    setPosenetLocalInstance(net: any) {
        this.posenetLocalInstance = net;
    }

    /*
        bigred ts main file -> ottobigredcamera.ts
        ottobigredcamera -> hands an image (video frame) to otto gesture analysis
        otto gesture analysis determines the pose, angles, and if any actions need to be taken
        hands it to this socket class for it to hand to the browser
        hands the browser the image, the pose data, and some state objects that would be
        useful for the browser to show.

        But in the meantime, it will work like:
        browser takes the picture, sends the pose data to the socket
        gesture analysis determines the angles and it any actions need to be taken
        hands it to this socket class for it to hand to the browser
        hands the browser some state objects that would be
        useful for the browser to know.
     */
    tempOnData(data) {
        // console.log('temp on data');
        ottoGestureAnalysis.analyzeGestures(data);
    }

    tempSendState(gestureState) {
        // console.log('sending state 2');
        // for (let key in this.browserSockets) {
        //     // console.log('key in browsersockets');
        //     const browserSocket = this.browserSockets[key];
        //     browserSocket.emit('gestureState', gestureState);
        // }
        this.tempSocket.emit('gestureState', gestureState);
        // this.tempSocket.emit('gestureState', {
        //     test: 'hi'
        // });
    }
}

export const ottoLocalSocket = new OttoLocalSocket();
