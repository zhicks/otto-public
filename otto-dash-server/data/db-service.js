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
    return DbService;
}());
exports.dbService = new DbService();
