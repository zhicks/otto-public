import {OttoItemType, OttoObjectStatus} from "../../otto-shared/constants";
import {dbService} from "../data/db-service";
import {OttoGroup, OttoLight, OttoSatellite, OttoStatusData} from "../../otto-shared/otto-interfaces";

declare const require;
const uuidv4 = require('uuid/v4');
const socketIo = require('socket.io');

class SocketControl {
    bigRed: any;
    satellites: any[] = [];
    appSockets: any[] = [];

    init(http: any) {
        let io = socketIo(http);
        io.on('connection', socket => {
            console.log('connection');
            socket.on('bigred', () => {
                console.log('big red connected');
                this.bigRed = socket;
                this.bigRed.bigRed = true;
            });
            socket.on('bigred_lights', (lightObjs) => {
                // These have plenty of info on them but for now we only care about a little bit
                console.log('got big red lights, calling update or insert if necessary');
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
                        console.log('could not find group for light id ', light.id);
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
            socket.on('satellite', (idObj: {id: string}) => {
                console.log('satellite connected with id', idObj.id);
                dbService.insertSatelliteIfNecessary(idObj.id);
                this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                let group = this.findGroupForSatelliteId(idObj.id);
                socket.emit('info', {
                    timeout: group ? group.lightTimeout : null
                });
            });
            socket.on('satellite_motion_status', (obj: { id: string, status: OttoObjectStatus }) => {
                // We send it piecemeal
                let group = this.findGroupForSatelliteId(obj.id);
                if (!group) {
                    console.log('could not find group for sat');
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
                console.log('app get status was called');
                if (!socket.appId) {
                    socket.appId = uuidv4();
                    this.appSockets.push(socket);
                }
                this.doStatus();
            });
            socket.on('refresh_status', () => {
                this.doStatus();
            });
            socket.on('app_update_program', () => {
                this.updateProgram();
            });
            socket.on('app_motion_on', (groupObj: {group: string}) => {
                console.log('turning motion on for group', groupObj);
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    console.log('cant find sat socket for turn motion off');
                } else {
                    satSocket.emit('turn_motion_on');
                }
            });
            socket.on('app_motion_off', (groupObj: {group: string}) => {
                console.log('turning motion off for group', groupObj);
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                if (!satSocket) {
                    console.log('cant find sat socket for turn motion off');
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
                if (this.bigRed) {
                    this.bigRed.emit('scan_lights');
                }
            });
            socket.on('satellite_motion_detected', (idObj: {id: string}) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    console.log('could not find group for sat');
                } else {
                    let lights = dbService.getLightsForGroupId(group.id);
                    let lightIds = lights.map(light => light.id);
                    this.bigRed.emit('turn_lights_on', {
                        lights: lightIds
                    });
                }
            });
            socket.on('satellite_motion_timeout', (idObj: {id: string}) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                if (!group) {
                    console.log('could not find group for sat');
                } else {
                    let lights = dbService.getLightsForGroupId(group.id);
                    let lightIds = lights.map(light => light.id);
                    this.bigRed.emit('turn_lights_off', {
                        lights: lightIds
                    });
                }
            });
            socket.on('satellite_idrsa', (idrsa: string) => {
                console.log('got idrsa');
                console.log(idrsa);
            });
            socket.on('disconnect', () => {
                console.log('socket disconnect');
                if (socket.bigRed) {
                    this.bigRed = null;
                    console.log('big red disconnect');
                }
                if (socket.satellite) {
                    console.log('socket is satellite', socket.satelliteId);
                    for (let i = 0; i < this.satellites.length; i++) {
                        let sat = this.satellites[i];
                        if (sat.satelliteId === socket.satelliteId) {
                            this.satellites.splice(i, 1);
                            console.log('satellite removed');
                            break;
                        }
                    }
                }
                if (socket.appId) {
                    console.log('socket is app', socket.appId);
                    for (let i = 0; i < this.appSockets.length; i++) {
                        let app = this.appSockets[i];
                        if (app.appId === socket.appId) {
                            this.appSockets.splice(i, 1);
                            console.log('app socket removed');
                            break;
                        }
                    }
                }
                console.log('satellites:');
                console.log(this.satellites.length);
                console.log('apps:');
                console.log(this.appSockets.length);
            });
        });
    }

    private doStatus() {
        console.log('calling do status');
        if (this.bigRed) {
            console.log('calling big red get bulb statuses');
            this.bigRed.emit('get_bulb_statuses');
        }
        for (let sat of this.satellites) {
            sat.emit('get_motion_status');
        }
    }

    updateProgram() {
        for (let satellite of this.satellites) {
            satellite.emit('update_program');
        }
    }

    private findSatSocketForGroupId(groupId: string) {
        // For now these actions just grab whatever satellite there is
        let group = <OttoGroup>dbService.findItemById(groupId, OttoItemType.Group);
        if (!group) {
            console.log('no group found for ', groupId);
        } else {
            let sat = dbService.findSatelliteForGroup(group.id);
            if (!sat) {
                console.log('no sat found for group id ', group.id);
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
        console.log('find gruop for light id ', lightId);
        let light = <OttoLight>dbService.findItemById(lightId, OttoItemType.Light);
        if (!light) {
            console.log('coudl not find light');
            return null;
        }
        return <OttoGroup>dbService.findItemById(light.group, OttoItemType.Group);
    }

}

export const socketControl = new SocketControl();