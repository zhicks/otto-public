
module OttoSatellite {

    let path = require('path');
    let express = require('express');
    let app = express();
    let fs = require('fs');
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');
    const SOCKET_ADDRESS = 'http://localhost:3500';
    const ID_FILE_PATH = '~/otto_id';
    const DEFAULT_TIMEOUT = 30 * 60 * 1000;
    const uuidv4 = require('uuid/v4');
    let cloudSocket: any;

    class OttoSatellite {
        id: string;
        timeoutLength: number;
        motionTimeout: any;

        init() {
            this.initServer();
            this.initId();
            this.initSocket();
        }
        secondaryInit() {
            this.initMotionDetection();
        }

        initServer() {
            app.set('view engine', 'html');
            app.set('port', (process.env.PORT || 3501));
            http.listen(app.get('port'), () => {
                console.log('listening on ' + app.get('port'));
            });
            console.log('satellite server started');
        }
        initId() {
            try {
                console.log('about to read from id file');
                let data = fs.readFileSync(ID_FILE_PATH).toString();
            } catch (e) {
                console.log('id did not exist, writing it');
                this.id = uuidv4();
                console.log('with id ' + this.id);
                fs.writeFileSync(ID_FILE_PATH, this.id);
            }
        }
        initSocket() {
            cloudSocket = socketIoClient(SOCKET_ADDRESS);
            cloudSocket.on('connect', () => {
                console.log('connection');
                cloudSocket.on('info', (infoObj) => {
                    let timeout = infoObj.timeout;
                    this.timeoutLength = timeout || DEFAULT_TIMEOUT;
                    this.secondaryInit();
                });
                cloudSocket.emit('satellite', {
                    id: this.id
                });
            });
        }
        initMotionDetection() {

        }

        onMotionDetected() {
            // We only care about the 1 - not the 0.
            // The satellite will send that motion was detected
            // and that its timer is done
            if (this.motionTimeout) {
                // It's currently on
                clearTimeout(this.motionTimeout);
            } else {
                // This is new
                cloudSocket.emit('satellite_motion_detected', { id: this.id });
            }
            this.setMotionTimeout();
        }
        private setMotionTimeout = () => {
            this.motionTimeout = setTimeout(() => {
                this.onMotionTimeout();
            }, this.timeoutLength);
        }
        private onMotionTimeout = () => {
            cloudSocket.emit('satellite_motion_timeout', { id: this.id });
            this.motionTimeout = null;
        }

    }
}














