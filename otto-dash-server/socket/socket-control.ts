import {OttoItemType, OttoObjectStatus} from "../../otto-shared/constants";
import {dbService} from "../data/db-service";
import {
    OttoGroup,
    OttoLight,
    OttoLoggerMessage,
    OttoSatellite,
    OttoStatusData
} from "../../otto-shared/otto-interfaces";

declare const require;
const uuidv4 = require('uuid/v4');
const socketIo = require('socket.io');

class OttoLogger {
    limit = 40;
    messages: OttoLoggerMessage[] = [];

    constructor(
        public id: string,
        public type: OttoItemType,
        private logToConsole: boolean
    ) {}

    log(message: string) {
        const messageObj = {
            ts: new Date(),
            ms: message,
            id: this.id,
            type: this.type
        }
        this.messages.unshift(messageObj);
        if (this.messages.length > this.limit) {
            this.messages.pop();
        }
        if (this.logToConsole) {
            console.log(message);
        }
        return messageObj;
    }
}

class SocketControl {
    bigRed: any;
    kathleenBoard: any;
    satellites: { satelliteId: string, emit: Function }[] = [];
    appSockets: any[] = [];
    loggers: {
        [id: string]: OttoLogger
    } = {};

    doLog(message: any) {
        const serverId = 'OTTO_SERVER';
        this.loggers[serverId] = this.loggers[serverId] || new OttoLogger(serverId, OttoItemType.Server, true);
        const messageObj = this.loggers[serverId].log(message);
        const messages: OttoLoggerMessage[] = [messageObj];
        this.appSockets.forEach(appSocket => {
            appSocket.emit('new_log', messages);
        });
    }

    init(http: any) {
        let io = socketIo(http);
        io.on('connection', socket => {
            this.doLog('connection');
            socket.on('kathleen_board_app', () => {
                if (!socket.appId) {
                    socket.appId = uuidv4();
                    this.appSockets.push(socket);
                }
                socket.emit('kathleen_board_ip', this.kathleenBoard && this.kathleenBoard.boardIp);
                if (this.kathleenBoard) {
                    console.log('emitting give ip');
                    this.kathleenBoard.emit('giveIp');
                }
            });
            socket.on('kathleen_board', () => {
               this.doLog('kathleen board connected');
               this.kathleenBoard = socket;
               this.kathleenBoard.kathleenBoard = true;
            });
            socket.on('kathleen_board_app_displayClock', () => {
                if (this.kathleenBoard) {
                    this.kathleenBoard.emit('displayClock');
                }
            });
            socket.on('kathleen_board_ip', (ip: string) => {
                console.log('got ip i think');
                this.doLog(ip);
                this.kathleenBoard.boardIp = ip;
            });
            socket.on('bigred', () => {
                this.doLog('big red connected');
                this.bigRed = socket;
                this.bigRed.bigRed = true;
            });
            socket.on('bigred_lights', (lightObjs) => {
                // These have plenty of info on them but for now we only care about a little bit
                this.doLog('got big red lights, calling update or insert if necessary');
                dbService.insertLightsFromBigRedIfNecessary(lightObjs);
            });
            socket.on('bigred_bulb_statuses', (lights: { id: string, status: OttoObjectStatus }[]) => {
                // We send it piecemeal
                let status: OttoStatusData = {
                    groups: []
                }
                for (let light of lights) {
                    let group = this.findGroupForLightId(light.id);
                    if (!group) {
                        this.doLog('could not find group for light id ' + light.id);
                    } else {
                        let foundGroup: any;
                        for (let g of status.groups) {
                            if (g.id === group.id) {
                                foundGroup = g;
                                break;
                            }
                        }
                        if (!foundGroup) {
                            foundGroup = {
                                id: group.id,
                                lights: []
                            };
                            status.groups.push(foundGroup);
                        }
                        foundGroup.lights.push(light);
                    }
                }
                for (let appSocket of this.appSockets) {
                    appSocket.emit('status', status);
                }
            });
            socket.on('satellite', (idObj: {id: string, ips: string[]}) => {
                this.doLog('satellite connected with id' + idObj.id);
                dbService.insertSatelliteIfNecessary(idObj.id);
                this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                socket.satelliteIps = idObj.ips || [];
                let group = this.findGroupForSatelliteId(idObj.id);
                socket.emit('info', {
                    timeout: group ? group.lightTimeout : null,
                    timeSettings: group ? group.timeSettings: null
                });
            });
            socket.on('satellite_motion_status', (obj: { id: string, status: OttoObjectStatus }) => {
                // We send it piecemeal
                let group = this.findGroupForSatelliteId(obj.id);
                if (!group) {
                    this.doLog('could not find group for sat');
                } else {
                    for (let appSocket of this.appSockets) {
                        appSocket.emit('status', <OttoStatusData>{
                            groups: [{
                                id: group.id,
                                motion: {
                                    status: obj.status
                                }
                            }]
                        });
                    }
                }
            });
            socket.on('app_get_status', () => {
                this.doLog('app get status was called');
                if (!socket.appId) {
                    socket.appId = uuidv4();
                    this.appSockets.push(socket);
                }
                this.doStatus();
            });
            socket.on('refresh_status', () => {
                this.doStatus();
            });
            socket.on('app_update_program_dev', () => {
                this.updateProgram(false);
            });
            socket.on('app_update_program_prod', () => {
                this.updateProgram(true);
            });
            socket.on('app_motion_on', (groupObj: {group: string}) => {
                this.doLog('turning motion on for group' + groupObj.group);
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    this.doLog('cant find sat socket for turn motion off');
                } else {
                    satSocket.emit('turn_motion_on');
                }
            });
            socket.on('app_motion_off', (groupObj: {group: string}) => {
                this.doLog('turning motion off for group' + groupObj.group);
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    this.doLog('cant find sat socket for turn motion off');
                } else {
                    satSocket.emit('turn_motion_off');
                }
            });
            socket.on('app_motion_off_temp', (groupObj: {group: string}) => {
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_off_temp');
            });
            socket.on('app_group_lights_on', (groupObj: {group: string}) => {
                // send to big red
                let lights = dbService.getLightsForGroupId(groupObj.group);
                let lightIds = lights.map(light => light.id);
                if (this.bigRed) {
                    this.bigRed.emit('turn_lights_on', {
                        lights: lightIds
                    })
                }
            });
            socket.on('app_group_lights_off', (groupObj: {group: string}) => {
                let lights = dbService.getLightsForGroupId(groupObj.group);
                let lightIds = lights.map(light => light.id);
                if (this.bigRed) {
                    this.bigRed.emit('turn_lights_off', {
                        lights: lightIds
                    })
                }
            });
            socket.on('app_scan_lights', () => {
                this.doLog('got app scan lights');
                if (this.bigRed) {
                    this.bigRed.emit('scan_lights');
                }
            });
            socket.on('app_log_dump', (idObj: { id: string }) => {
                let logDump: OttoLoggerMessage[] = [];
                if (!idObj) {
                    for (let key in this.loggers) {
                        let logger: OttoLogger = this.loggers[key];
                        // TODO App Dump
                    }
                } else {
                    let logger = this.loggers[idObj.id];
                    if (!logger) {
                        logDump = [{
                            ts: new Date(),
                            ms: 'log dump was empty for id ' + idObj.id,
                            id: 'none',
                            type: OttoItemType.None
                        }];
                    } else {
                        logDump = logger.messages;
                    }
                }
                socket.emit('log_dump', logDump);
            });
            socket.on('app_sendBoardMessage', (obj: any) => {
                this.doLog('message received');
                console.log(obj);
                this.kathleenBoard && this.kathleenBoard.emit('message', obj);
            });
            socket.on('sat_log', (log: { id: string, msg: any }) => {
                this.loggers[log.id] = this.loggers[log.id] || new OttoLogger(log.id, OttoItemType.Satellite, false);
                const messageObj = this.loggers[log.id].log(log.msg);
                const messages: OttoLoggerMessage[] = [messageObj];
                this.appSockets.forEach(appSocket => {
                    appSocket.emit('new_log', messages);
                });
            });
            socket.on('satellite_motion_detected', (idObj: { id: string, pirnum: string }) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    this.doLog('could not find group for sat');
                } else {
                    let lights = dbService.getLightsForGroupId(group.id);
                    let lightIds = lights.map(light => light.id);
                    // -------------------------------------------------------------------
                    // const hallwayGroupId = '965d127f-c079-4bbd-8bf3-d016349a71af';
                    // const diningRoomLightId = '00:17:88:01:03:44:bd:8f-0b';
                    // if (group.id === hallwayGroupId) {
                    //     // If it's 4, we only turn the hallway light on, which is default
                    //     // If it's 17, we also turn the dining room light on
                    //     console.log('it was hallway group id');
                    //     console.log('pir num ');
                    //     console.log(idObj.pirnum);
                    //     console.log(typeof idObj.pirnum);
                    //     if (idObj.pirnum === '17') {
                    //         lightIds.push(diningRoomLightId);
                    //     }
                    // }
                    // -------------------------------------------------------------------
                    this.bigRed && this.bigRed.emit('turn_lights_on', {
                        lights: lightIds,
                        timeSettings: group.timeSettings
                    });
                }
            });
            socket.on('sat_mot', (idObj: {id: string, pirnum: number}) => {
                this.appSockets.forEach(appSocket => {
                    appSocket.emit('sat_mot', idObj);
                });
            });
            socket.on('satellite_motion_timeout', (idObj: {id: string}) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    this.doLog('could not find group for sat');
                } else {
                    let lights = dbService.getLightsForGroupId(group.id);
                    let lightIds = lights.map(light => light.id);
                    this.bigRed && this.bigRed.emit('turn_lights_off', {
                        lights: lightIds
                    });
                }
            });
            socket.on('satellite_idrsa', (idrsa: string) => {
                this.doLog('got idrsa');
                this.doLog(idrsa);
            });
            socket.on('disconnect', () => {
                this.doLog('socket disconnect');
                if (socket.bigRed) {
                    this.bigRed = null;
                    this.doLog('big red disconnect');
                }
                if (socket.kathleenBoard) {
                    this.kathleenBoard = null;
                    this.doLog('kathleen board disconnect');
                }
                if (socket.satellite) {
                    this.doLog('socket is satellite' + socket.satelliteId);
                    for (let i = 0; i < this.satellites.length; i++) {
                        let sat = this.satellites[i];
                        if (sat.satelliteId === socket.satelliteId) {
                            this.satellites.splice(i, 1);
                            this.doLog('satellite removed');
                            break;
                        }
                    }
                }
                if (socket.appId) {
                    this.doLog('socket is app' + socket.appId);
                    for (let i = 0; i < this.appSockets.length; i++) {
                        let app = this.appSockets[i];
                        if (app.appId === socket.appId) {
                            this.appSockets.splice(i, 1);
                            this.doLog('app socket removed');
                            break;
                        }
                    }
                }
                this.doLog('satellites:');
                this.doLog(this.satellites.length);
                this.doLog('apps:');
                this.doLog(this.appSockets.length);
            });
        });
    }

    private doStatus() {
        this.doLog('calling do status');
        if (this.bigRed) {
            this.doLog('calling big red get bulb statuses');
            this.bigRed.emit('get_bulb_statuses');
        }
        for (let sat of this.satellites) {
            sat.emit('get_motion_status');
        }
    }

    updateProgram(doProd: boolean) {
        const eventString = `update_program${doProd ? '_prod' : '_dev'}`;
        for (let satellite of this.satellites) {
            satellite.emit(eventString);
        }
    }

    private findSatSocketForGroupId(groupId: string) {
        // For now these actions just grab whatever satellite there is
        let group = <OttoGroup>dbService.findItemById(groupId, OttoItemType.Group);
        if (!group) {
            this.doLog('no group found for ' + groupId);
        } else {
            let sat = dbService.findSatelliteForGroup(group.id);
            if (!sat) {
                this.doLog('no sat found for group id ' + group.id);
            } else {
                let satSocket: any;
                for (let socket of this.satellites) {
                    if (socket.satelliteId === sat.id) {
                        return socket;
                    }
                }
            }
        }
    }
    private findGroupForSatelliteId(satId: string): OttoGroup {
        let sat = <OttoSatellite>dbService.findItemById(satId, OttoItemType.Satellite);
        if (!sat) {
            return null;
        }
        return <OttoGroup>dbService.findItemById(sat.group, OttoItemType.Group);
    }
    private findGroupForLightId(lightId: string): OttoGroup {
        this.doLog('find gruop for light id ' + lightId);
        let light = <OttoLight>dbService.findItemById(lightId, OttoItemType.Light);
        if (!light) {
            this.doLog('coudl not find light');
            return null;
        }
        return <OttoGroup>dbService.findItemById(light.group, OttoItemType.Group);
    }

}

export const socketControl = new SocketControl();