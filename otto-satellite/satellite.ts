import {OttoObjectStatus} from "../otto-shared/constants";

module OttoSatelliteModule {

    declare const require;
    declare const process;
    let path = require('path');
    let express = require('express');
    let app = express();
    let fs = require('fs');
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');
    const SOCKET_ADDRESS = process.argv && process.argv[2] === 'prod' ? 'http://blackboxjs.com:3500': 'http://192.168.1.102:3500';
    console.log('socket address is ', SOCKET_ADDRESS);
    const ID_FILE_PATH = '../../otto_id';
    const BASH_UPDATE_SCRIPT_FILE_PATH = '../../otto_update_script.sh';
    const DEFAULT_TIMEOUT = 2 * 60 * 1000;
    const uuidv4 = require('uuid/v4');
    const Gpio = require('onoff').Gpio;
    const pir = new Gpio(4, 'in', 'both'); // or 7, I forget
    const TEMP_TIMEOUT_LENGTH = 1 * 60 * 1000;
    const { exec } = require('child_process');
    let cloudSocket: any;

    class OttoSatellite {
        id: string;
        timeoutLength: number;
        motionTimeout: any;
        didSecondaryInit = false;
        motionStatus = OttoObjectStatus.On;
        motionTempOffTimeout: any;

        init() {
            console.log('THE UPDATE WORKED');
            this.initServer();
            this.initId();
            this.initBashScript();
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
        initBashScript() {
            fs.writeFileSync(BASH_UPDATE_SCRIPT_FILE_PATH, BashScript);
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
                    console.log('got info from cloud socket: ', infoObj);
                    console.log('time out length is ' + this.timeoutLength);
                    if (!this.didSecondaryInit) {
                        console.log('did not init motion yet, calling secondary init for motion');
                        this.secondaryInit();
                    } else {
                        console.log('already did motion init, just setting timeout');
                    }
                });
                cloudSocket.on('update_program', () => {
                    console.log('update program called');
                    this.updateProgram();
                });
                cloudSocket.on('turn_motion_on', () => {
                    console.log('turn motion on called');
                    clearTimeout(this.motionTempOffTimeout);
                    this.motionStatus = OttoObjectStatus.On;
                });
                cloudSocket.on('turn_motion_off', () => {
                    console.log('turn motion off called');
                    clearTimeout(this.motionTempOffTimeout);
                    this.motionStatus = OttoObjectStatus.Off;
                });
                cloudSocket.on('turn_motion_off_temp', () => {
                    console.log('turn motion off temp called');
                    if (this.motionStatus !== OttoObjectStatus.OffTemporarily) {
                        this.motionTempOffTimeout = setTimeout(() => {
                            this.motionStatus = OttoObjectStatus.On;
                        }, TEMP_TIMEOUT_LENGTH);
                    }
                    this.motionStatus = OttoObjectStatus.OffTemporarily;
                });
                cloudSocket.on('get_motion_status', () => {
                    cloudSocket.emit('satellite_motion_status', {
                        id: this.id,
                        status: this.motionStatus
                    });
                });
                console.log('saying hello to cloud socket, id: ', this.id);
                cloudSocket.emit('satellite', {
                    id: this.id
                });
            });
        }
        initMotionDetection() {
            pir.watch((err, value) => {
                if (err) {
                    console.log('Error in PIR watch:');
                    console.log(err);
                } else {
                    console.log(' ----- motion logged: ', value);
                    if (value === 1) {
                        console.log('value is 1, calling motion detected');
                        this.onMotionDetected();
                    }
                }
            });
            this.didSecondaryInit = true;
        }

        onMotionDetected() {
            // We only care about the 1 - not the 0.
            // The satellite will send that motion was detected
            // and that its timer is done
            if (this.motionTimeout) {
                console.log('motion timeout exists, clearing timeout');
                // It's currently on
                clearTimeout(this.motionTimeout);
            } else {
                // This is new
                console.log('motion timeout did not exist, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_detected', { id: this.id });
            }
            this.setMotionTimeout();
        }
        private setMotionTimeout = () => {
            console.log('setting motion timeout');
            this.motionTimeout = setTimeout(() => {
                this.onMotionTimeout();
            }, this.timeoutLength);
        }
        private onMotionTimeout = () => {
            console.log('motion timed out, emitting to cloud socket');
            cloudSocket.emit('satellite_motion_timeout', { id: this.id });
            this.motionTimeout = null;
        }

        private updateProgram() {
            console.log('calling update program');
            exec(`bash ${BASH_UPDATE_SCRIPT_FILE_PATH} `, (err, stdout, stderr) => {
                if (err) {
                    console.log('Error updating program');
                    console.log(err);
                }
                console.log(stdout);
            });
        }

    }

    const BashScript = `
        git pull;
        pkill -f node;
        npm run start > ~/output.txt;
    `;

    new OttoSatellite().init();
}














