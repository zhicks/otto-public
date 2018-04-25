"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var db_service_1 = require("../data/db-service");
function isUserLoggedIn(req) {
    var userId = getUserId(req);
    return !!userId;
}
exports.isUserLoggedIn = isUserLoggedIn;
function checkAuthenticated(req, res, next) {
    if (!isUserLoggedIn(req)) {
        res.redirect('/login');
        // res.status(401).send({notAuthorized: true});
    }
    else {
        return next();
    }
}
exports.checkAuthenticated = checkAuthenticated;
function getCookie(req) {
    return req.ottoCookie;
}
function getUserId(req) {
    var cookie = getCookie(req);
    return cookie && cookie.userId;
}
function setUserIdForCookie(req, userId) {
    getCookie(req).userId = userId;
}
var MainController = /** @class */ (function () {
    function MainController() {
    }
    MainController.prototype.login = function (req, res) {
        var password = req.body.password;
        if (password !== 'zack') {
            res.status(401).send('Password not right');
        }
        else {
            setUserIdForCookie(req, 'FloorKraken');
            res.send({ ok: 'ok' });
        }
    };
    MainController.prototype.getStuff = function (req, res) {
        var stuff = db_service_1.dbService.getStuff();
        res.send(stuff);
    };
    MainController.prototype.getById = function (req, res) {
        var id = req.params.id;
        var type = +req.params.type;
        var object = db_service_1.dbService.findItemById(id, type);
        res.send(object);
    };
    MainController.prototype.saveGroup = function (req, res) {
        var id = req.params.id;
        var newName = req.body.name;
        var object = db_service_1.dbService.saveGroup(id, newName);
        res.send(object);
    };
    MainController.prototype.saveGroupForItem = function (req, res) {
        var id = req.params.id;
        var groupId = req.body.groupId;
        var type = +req.params.type;
        var object = db_service_1.dbService.saveGroupForItem(id, groupId, type);
        res.send(object);
    };
    MainController.prototype.saveNameForItem = function (req, res) {
        var id = req.params.id;
        var newName = req.body.name;
        var type = +req.params.type;
        var object = db_service_1.dbService.saveNameForItem(id, newName, type);
        res.send(object);
    };
    return MainController;
}());
exports.mainController = new MainController();
