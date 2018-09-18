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
            // console.log('calling take pic just the one time');
            socket.emit('satellite');
            // setTimeout(() => {
            //     this.takePic();
            // }, 2000);
        });
        this.takePicInterval = setInterval(() => {
            console.log('taking pic');
            this.takePic();
        }, 1000 / FRAME_RATE);
    }

    takePic() {
        const camProcess = exec('fswebcam --crop 280x280 --no-banner - | base64', (error, stdout, stderr) => {
            // console.log(stdout);
            console.log('took pic', stdout.length);
            if (stdout.length && this.socket) {
                console.log('emitting to socket');
                this.socket.emit('image', stdout);
            }
        });
    }

}

export const satelliteCamera = new SatelliteCamera();