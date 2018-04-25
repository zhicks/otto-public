import {OttoBaseItem, OttoDb, OttoGroup, OttoItem, OttoLight} from "../../otto-shared/otto-interfaces";
import {OttoItemType} from "../../otto-shared/constants";

declare const require;
const fs = require('fs');
const uuidv4 = require('uuid/v4');

const DB_FILE_PATH = './data/db.json';

class DbService {
    dbContent: OttoDb;

    constructor() {}

    init() {
        // Reading and writing will be sync for now
        let data = fs.readFileSync(DB_FILE_PATH);
        this.dbContent = JSON.parse(data.toString());
        console.log(this.dbContent);
    }

    getStuff() {
        return this.dbContent;
    }

    saveGroup(groupId: string, groupName: string) {
        if (!groupId) {
            let group = {
                id: this.generateUniqueId(),
                name: groupName,
                lightTimeout: 2 * 60 * 1000
            };
            this.dbContent.groups.push(group);
            this.doWrite();
            return group;
        } else {
            let group = this.findGroupById(groupId);
            group.name = groupName;
            this.doWrite();
            return group;
        }
    }

    saveGroupForItem(itemId: string, groupId: string, type: OttoItemType) {
        let light: OttoLight = <OttoLight>this.findItemById(itemId, type);
        light.group = groupId;
        this.doWrite();
        return light;
    }

    saveNameForItem(itemId: string, newName: string, type: OttoItemType) {
        let item = this.findItemById(itemId, type);
        item.name = newName;
        this.doWrite();
        return item;
    }

    insertLightsFromBigRedIfNecessary(lightObjs: any[]) {
        // lots of props on those light objs but we only care about a few of those props for now
        let lightsToInsert: OttoLight[] = [];
        for (let bigRedLight of lightObjs) {
            let foundLight;
            for (let dbLight of this.dbContent.lights) {
                if (dbLight.id === bigRedLight.id) {
                    foundLight = dbLight;
                    break;
                }
            }
            if (!foundLight) {
                lightsToInsert.push({
                    type: bigRedLight.type,
                    id: bigRedLight.id,
                    name: '',
                    group: ''
                });
            }
        }
        if (lightsToInsert.length) {
            for (let light of lightsToInsert) {
                this.dbContent.lights.push(light);
            }
            this.doWrite();
        }
    }

    private doWrite() {
        let content = JSON.stringify(this.dbContent);
        fs.writeFileSync(DB_FILE_PATH, content);
    }
    private generateUniqueId() {
        return uuidv4();
    }
    private findGroupById(id: string) {
        for (let group of this.dbContent.groups) {
            if (group.id === id) {
                return group;
            }
        }
    }
    findItemById(id: string, type: OttoItemType) {
        let arr: OttoBaseItem[];
        switch(type) {
            case OttoItemType.Group:
                arr = this.dbContent.groups;
                break;
            case OttoItemType.Light:
                arr = this.dbContent.lights;
                break;
            case OttoItemType.Satellite:
                arr = this.dbContent.satellites;
                break;
        }
        for (let item of arr) {
            console.log(item);
            if (item.id === id) {
                return item;
            }
        }
    }
    findSatelliteForGroup(groupId: string) {
        for (let sat of this.dbContent.satellites) {
            if (sat.group === groupId) {
                return sat;
            }
        }
    }
    getLightsForGroupId(groupId: string) {
        let lights = [];
        for (let light of this.dbContent.lights) {
            if (light.group === groupId) {
                lights.push(light);
            }
        }
        return lights;
    }
}
export const dbService = new DbService();