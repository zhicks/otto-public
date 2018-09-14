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
        });
        this.takePicInterval = setInterval(() => {
            this.takePic();
        }, FRAME_RATE);
    }

    takePic() {
        const camProcess = exec('fswebcam -', (error, stdout, stderr) => {
            console.log(stdout);
            if (this.socket) {
                // not yet
                // this.socket.emit('image', stdout);
            }
        });
        // camProcess.stdout.on('data', (data) => {
        //    console.log(data);
        // });
    }

}

export const satelliteCamera = new SatelliteCamera();