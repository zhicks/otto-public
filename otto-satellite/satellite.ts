import {OttoObjectStatus} from "../otto-shared/constants";
import {OttoTimeSettings} from "../otto-shared/otto-interfaces";
import { satelliteCamera } from './satellite-camera';

module OttoSatelliteModule {

    declare const require;
    declare const process;
    let path = require('path');
    let express = require('express');
    let app = express();
    let fs = require('fs');
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');
    const isProd = process.argv && process.argv[2] === 'prod';
    const SOCKET_ADDRESS = isProd ? '': 'http://192.168.1.102:3500';
    console.log('socket address is ', SOCKET_ADDRESS);
    const ID_FILE_PATH = '../../otto_id';
    const BASH_UPDATE_SCRIPT_FILE_PATH = '../../otto_update_script.sh';
    const DEFAULT_TIMEOUT = 14 * 1000;
    const uuidv4 = require('uuid/v4');
    const Gpio = require('onoff').Gpio;
    const TEMP_TIMEOUT_LENGTH = 5 * 1000;
    let USERNAME = 'sunny';
    const { spawn } = require('child_process');
    const os = require('os');
    const OTTO_LOCAL_SERVER_IP = 'http://192.168.1.102:3505';
    let cloudSocket: any;
    const CAMERA_SATELLITE_ID = '85b4260b-9897-43ac-8c96-814e66eabb40';

    const pir4 = new Gpio(4, 'in', 'both');
    const pir17 = new Gpio(17, 'in', 'both');

    // NEXT: Test watching 17 if there's nothing plugged in before trying anything else

    class OttoSatellite {
        id: string;
        timeoutLength: number;
        motionTimeout: any;
        didSecondaryInit = false;
        motionStatus = OttoObjectStatus.On;
        motionTempOffTimeout: any;
        updateProgramCalled = false;
        timeSettings: { [hourTime: string]: OttoTimeSettings };

        doLog(message: any) {
            console.log(message);
            if (cloudSocket) {
                cloudSocket.emit('sat_log', { id: this.id, msg: message });
            }
        }

        init() {
            this.initServer();
            this.initId();
            this.initTimeCheckLoop();
            this.initSocket();
            this.initCamera();
        }
        secondaryInit() {
            this.initMotionDetection();
        }
        initServer() {
            app.set('view engine', 'html');
            app.set('port', (process.env.PORT || 3501));
            http.listen(app.get('port'), () => {
                this.doLog('listening on ' + app.get('port'));
            });
            this.doLog('satellite server started');
        }
        initCamera() {
            let isCameraSatellite = this.id === CAMERA_SATELLITE_ID;
            if (isCameraSatellite) {
                this.doLog('am camera satellite');
                const newSocket = socketIoClient(OTTO_LOCAL_SERVER_IP);
                satelliteCamera.init(newSocket);
            }
        }
        writeBashScript(doProd: boolean) {
            fs.writeFileSync(BASH_UPDATE_SCRIPT_FILE_PATH, BashScript(doProd));
        }
        initTimeCheckLoop() {
            setInterval(() => {
                if (this.timeSettings) {
                    let currentHour = new Date().getHours();
                    let hours: string[] = Object.keys(this.timeSettings).sort((a, b) => {
                        if (+a > +b) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });
                    let currentObj: OttoTimeSettings = this.timeSettings[hours[hours.length-1]];
                    hours.forEach(hourString => {
                        if (currentHour >= +hourString) {
                            currentObj = this.timeSettings[hourString];
                        }
                    });
                    if (currentObj.lightTimeout && currentObj.lightTimeout !== this.timeoutLength) {
                        this.timeoutLength = currentObj.lightTimeout;
                        this.doLog('setting different light timeout ' + this.timeoutLength);
                        this.doLog('my current hour is ' + currentHour);
                    }
                }
            }, 5 * 1000);
        }
        initId() {
            try {
                this.doLog('about to read from id file');
                let data = fs.readFileSync(ID_FILE_PATH).toString();
                this.doLog('id from data is ' + JSON.stringify(data));
                this.id = data;
            } catch (e) {
                this.doLog('id did not exist, writing it');
                this.id = uuidv4();
                this.doLog('with id ' + this.id);
                fs.writeFileSync(ID_FILE_PATH, this.id);
            }
            try {
                let exists = fs.readFileSync('/home/pi/pi_id_otto_hack');
                this.doLog('username is pi');
                USERNAME = 'pi';//
            } catch (e) {
                this.doLog('username staying as sunny');
            }
        }
        initSocket() {
            cloudSocket = socketIoClient(SOCKET_ADDRESS);
            cloudSocket.on('connect', () => {
                this.doLog('connection');
                cloudSocket.on('info', (infoObj: { timeout: number, timeSettings: { [hourTime: string]: OttoTimeSettings } }) => {
                    let timeout = infoObj.timeout;
                    this.timeoutLength = timeout || DEFAULT_TIMEOUT;
                    if (infoObj.timeSettings) {
                        this.doLog('obj has time settings');
                        this.timeSettings = infoObj.timeSettings;
                    }
                    this.doLog('got info from cloud socket: ' + JSON.stringify(infoObj));
                    this.doLog('time out length is ' + this.timeoutLength);
                    if (!this.didSecondaryInit) {
                        this.doLog('did not init motion yet, calling secondary init for motion');
                        this.secondaryInit();
                    } else {
                        this.doLog('already did motion init, just setting timeout');
                    }
                });
                cloudSocket.on('update_program_prod', () => {
                    this.doLog('update program called');
                    this.updateProgram(true);
                });
                cloudSocket.on('update_program_dev', () => {
                    this.doLog('update program called');
                    this.updateProgram(false);
                });
                cloudSocket.on('turn_motion_on', () => {
                    this.doLog('turn motion on called');
                    clearTimeout(this.motionTempOffTimeout);
                    clearTimeout(this.motionTimeout);
                    this.motionStatus = OttoObjectStatus.On;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('turn_motion_off', () => {
                    this.doLog('turn motion off called');
                    clearTimeout(this.motionTempOffTimeout);
                    clearTimeout(this.motionTimeout);
                    this.motionStatus = OttoObjectStatus.Off;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('turn_motion_off_temp', () => {
                    this.doLog('turn motion off temp called');
                    if (this.motionStatus !== OttoObjectStatus.OffTemporarily) {
                        this.motionTempOffTimeout = setTimeout(() => {
                            this.motionStatus = OttoObjectStatus.On;
                        }, TEMP_TIMEOUT_LENGTH);
                    }
                    this.motionStatus = OttoObjectStatus.OffTemporarily;
                    cloudSocket.emit('refresh_status');
                });
                cloudSocket.on('get_motion_status', () => {
                    cloudSocket.emit('satellite_motion_status', {
                        id: this.id,
                        status: this.motionStatus
                    });
                });
                cloudSocket.on('ping', () => {
                    // this.doLog(`cloud socket ping ${new Date()}`);
                    // cloudSocket.emit('pong', { id: this.id });
                });
                this.doLog('saying hello to cloud socket, id: ' + this.id);
                let ips: string[] = [];
                try {
                    const ifaces = os.networkInterfaces();
                    Object.keys(ifaces).forEach(ifname => {
                        let alias = 0;
                        ifaces[ifname].forEach(function (iface) {
                            if ('IPv4' !== iface.family || iface.internal !== false) {
                                return;
                            }
                            ips.push(iface.address);
                            ++alias;
                        });
                    });
                } catch (e) {
                    this.doLog('error when getting the ip');
                }
                cloudSocket.emit('satellite', {
                    id: this.id,
                    ips: ips
                });
            });
        }
        private innerInitMotionDetection(err, value, pirnum: string) {
            if (err) {
                this.doLog(`Error in PIR watch ${pirnum}:`);
                this.doLog(err);
            } else {
                this.doLog(` ----- m ${pirnum}: ` + value);
                if (value === 1) {
                    if (cloudSocket) {
                        this.doLog(`emitting motion to cloud ${pirnum}`);
                        cloudSocket.emit('sat_mot', {
                            id: this.id,
                            pirnum: pirnum
                        });
                    }
                    if (this.motionStatus === OttoObjectStatus.On) {
                        this.doLog('calling motion detected');
                        this.onMotionDetected(pirnum);
                    } else {
                        this.doLog('not calling motion detected');
                    }
                }
            }
        }
        initMotionDetection() {
            pir4.watch((err, value) => {
                this.innerInitMotionDetection(err, value, '4');
            });
            pir17.watch((err, value) => {
                this.innerInitMotionDetection(err, value, '17');
            });
            this.didSecondaryInit = true;
        }
        onMotionDetected(pirnum: string) {
            // We only care about the 1 - not the 0.
            // The satellite will send that motion was detected
            // and that its timer is done
            if (this.motionTimeout) {
                this.doLog('motion timeout exists, clearing timeout');
                // It's currently on
                clearTimeout(this.motionTimeout);
            } else {
                // This is new
                this.doLog('motion timeout did not exist, emitting to cloud socket');
                cloudSocket.emit('satellite_motion_detected', { id: this.id, pirnum: pirnum });
            }
            this.setMotionTimeout();
        }
        private setMotionTimeout = () => {
            this.doLog('setting motion timeout');
            this.motionTimeout = setTimeout(() => {
                this.onMotionTimeout();
            }, this.timeoutLength);
        }
        private onMotionTimeout = () => {
            this.doLog('motion timed out, emitting to cloud socket');
            cloudSocket.emit('satellite_motion_timeout', { id: this.id });
            this.motionTimeout = null;
        }

        private updateProgram(doProd: boolean) {
            if (!this.updateProgramCalled) {
                this.doLog(`calling update program - doProd: ${doProd}`);
                this.writeBashScript(doProd);
                spawn(`bash`, [BASH_UPDATE_SCRIPT_FILE_PATH], {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: 'inherit'
                });
                this.updateProgramCalled = true;
            }
        }

    }

    const BashScript = (doProd: boolean) => { return `
        pkill -f node;
        cd /home/${USERNAME}/otto/otto-satellite;
        git stash;
        git clean  -d  -fx .;
        git pull;
        npm install;
        npm run start${doProd ? `-prod` : ''};
    `};

    new OttoSatellite().init();
}














