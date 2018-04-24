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
            socket.on('bigred_bulb_statuses', (lights: { id: string, status: OttoObjectStatus }[]) => {
                // We send it piecemeal
                let status: OttoStatusData = {
                    groups: []
                }
                for (let light of lights) {
                    let group = this.findGroupForLightId(light.id);
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
                for (let appSocket of this.appSockets) {
                    appSocket.emit('status', status);
                }
            });
            socket.on('satellite', (idObj: {id: string}) => {
                console.log('satellite connected with id', idObj.id);
                this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
                socket.emit('info', {
                    timeout: 30 * 60 * 1000
                });
            });
            socket.on('satellite_motion_status', (obj: { id: string, status: OttoObjectStatus }) => {
                // We send it piecemeal
                let group = this.findGroupForSatelliteId(obj.id);
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
            });
            socket.on('app_get_status', () => {
                console.log('app get status was called');
                // get bulb statuses
                // then get satellite statuses
                if (this.bigRed) {
                    this.bigRed.emit('get_bulb_statuses');
                }
                for (let sat of this.satellites) {
                    sat.emit('get_motion_status');
                }
            });
            socket.on('app_update_program', () => {
                this.updateProgram();
            });
            socket.on('app_motion_on', (groupObj: {group: string}) => {
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_on');
            });
            socket.on('app_motion_off', (groupObj: {group: string}) => {
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_off');
            });
            socket.on('app_motion_on_temp', (groupObj: {group: string}) => {
                let satSocket = this.findSatSocketForGroupId(groupObj.group);
                satSocket.emit('turn_motion_off_temp');
            });
            socket.on('satellite_motion_detected', (idObj: {id: string}) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                let lights = dbService.getLightsForGroupId(group.id);
                this.bigRed.emit('turn_lights_on', {
                    lights: lights
                });
            });
            socket.on('satellite_motion_timeout', (idObj: {id: string}) => {
                let group = this.findGroupForSatelliteId(idObj.id);
                let lights = dbService.getLightsForGroupId(group.id);
                this.bigRed.emit('turn_lights_off', {
                    lights: lights
                });
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
                console.log('satellites:');
                console.log(this.satellites);
            });
        });
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
                let satSocket: any;
                for (let socket of this.satellites) {
                    if (socket.id === sat.id) {
                        return socket;
                    }
                }
            }
        }
    }
    private findGroupForSatelliteId(satId: string): OttoGroup {
        let sat = <OttoSatellite>dbService.findItemById(satId, OttoItemType.Satellite);
        return <OttoGroup>dbService.findItemById(sat.group, OttoItemType.Group);
    }
    private findGroupForLightId(lightId: string): OttoGroup {
        let sat = <OttoLight>dbService.findItemById(lightId, OttoItemType.Light);
        return <OttoGroup>dbService.findItemById(sat.group, OttoItemType.Group);
    }
}

export const socketControl = new SocketControl();