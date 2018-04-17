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
                name: groupName
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
}
export const dbService = new DbService();