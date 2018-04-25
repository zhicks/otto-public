"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("../../otto-shared/constants");
var fs = require('fs');
var uuidv4 = require('uuid/v4');
var DB_FILE_PATH = './data/db.json';
var DbService = /** @class */ (function () {
    function DbService() {
    }
    DbService.prototype.init = function () {
        // Reading and writing will be sync for now
        var data = fs.readFileSync(DB_FILE_PATH);
        this.dbContent = JSON.parse(data.toString());
        console.log(this.dbContent);
    };
    DbService.prototype.getStuff = function () {
        return this.dbContent;
    };
    DbService.prototype.saveGroup = function (groupId, groupName) {
        if (!groupId) {
            var group = {
                id: this.generateUniqueId(),
                name: groupName,
                lightTimeout: 2 * 60 * 1000
            };
            this.dbContent.groups.push(group);
            this.doWrite();
            return group;
        }
        else {
            var group = this.findGroupById(groupId);
            group.name = groupName;
            this.doWrite();
            return group;
        }
    };
    DbService.prototype.saveGroupForItem = function (itemId, groupId, type) {
        var light = this.findItemById(itemId, type);
        light.group = groupId;
        this.doWrite();
        return light;
    };
    DbService.prototype.saveNameForItem = function (itemId, newName, type) {
        var item = this.findItemById(itemId, type);
        item.name = newName;
        this.doWrite();
        return item;
    };
    DbService.prototype.insertLightsFromBigRedIfNecessary = function (lightObjs) {
        // lots of props on those light objs but we only care about a few of those props for now
        var lightsToInsert = [];
        for (var _i = 0, lightObjs_1 = lightObjs; _i < lightObjs_1.length; _i++) {
            var bigRedLight = lightObjs_1[_i];
            var foundLight = void 0;
            for (var _a = 0, _b = this.dbContent.lights; _a < _b.length; _a++) {
                var dbLight = _b[_a];
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
            for (var _c = 0, lightsToInsert_1 = lightsToInsert; _c < lightsToInsert_1.length; _c++) {
                var light = lightsToInsert_1[_c];
                this.dbContent.lights.push(light);
            }
            this.doWrite();
        }
    };
    DbService.prototype.doWrite = function () {
        var content = JSON.stringify(this.dbContent);
        fs.writeFileSync(DB_FILE_PATH, content);
    };
    DbService.prototype.generateUniqueId = function () {
        return uuidv4();
    };
    DbService.prototype.findGroupById = function (id) {
        for (var _i = 0, _a = this.dbContent.groups; _i < _a.length; _i++) {
            var group = _a[_i];
            if (group.id === id) {
                return group;
            }
        }
    };
    DbService.prototype.findItemById = function (id, type) {
        var arr;
        switch (type) {
            case constants_1.OttoItemType.Group:
                arr = this.dbContent.groups;
                break;
            case constants_1.OttoItemType.Light:
                arr = this.dbContent.lights;
                break;
            case constants_1.OttoItemType.Satellite:
                arr = this.dbContent.satellites;
                break;
        }
        for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
            var item = arr_1[_i];
            console.log(item);
            if (item.id === id) {
                return item;
            }
        }
    };
    DbService.prototype.findSatelliteForGroup = function (groupId) {
        for (var _i = 0, _a = this.dbContent.satellites; _i < _a.length; _i++) {
            var sat = _a[_i];
            if (sat.group === groupId) {
                return sat;
            }
        }
    };
    DbService.prototype.getLightsForGroupId = function (groupId) {
        var lights = [];
        for (var _i = 0, _a = this.dbContent.lights; _i < _a.length; _i++) {
            var light = _a[_i];
            if (light.group === groupId) {
                lights.push(light);
            }
        }
        return lights;
    };
    return DbService;
}());
exports.dbService = new DbService();
