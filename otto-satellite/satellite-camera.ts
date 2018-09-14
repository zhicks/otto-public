declare const require;

const exec = require('child_process').exec;

const FRAME_RATE = 3;

// Make sure to:
// sudo apt-get install fswebcam

class SatelliteCamera {

    socket = null;
    takePicInterval = null;

    init(socket: any) {
        this.socket = socket;
        socket.on('connect', () => {
            console.log('connected to big red');
            console.log('calling take pic just the one time');
            this.takePic();
        });
        // this.takePicInterval = setInterval(() => {
        //     this.takePic();
        // }, 1000 / FRAME_RATE);
    }

    takePic() {
        const camProcess = exec('fswebcam -', (error, stdout, stderr) => {
            console.log(stdout);
            if (this.socket) {
                // not yet
                // this.socket.emit('image', stdout);
                // make sure to crop it
                // just have big red save it at first
            }
        });
        // camProcess.stdout.on('data', (data) => {
        //    console.log(data);
        // });
    }

}

export const satelliteCamera = new SatelliteCamera();