import {dbService} from "../data/db-service";
import {socketControl} from "../socket/socket-control";

export function isUserLoggedIn(req) {
    let userId = getUserId(req);
    return !!userId;
}
export function checkAuthenticated(req, res, next) {
    if (!isUserLoggedIn(req)) {
        res.redirect('/login');
        // res.status(401).send({notAuthorized: true});
    } else {
        return next();
    }
}
function getCookie(req) {
    return req.ottoCookie;
}
function getUserId(req) {
    let cookie = getCookie(req);
    return cookie && cookie.userId;
}
function setUserIdForCookie(req, userId: string) {
    getCookie(req).userId = userId;
}

class MainController {

    login(req, res) {
        let password = req.body.password;
        if (password !== 'zack') {
            res.status(401).send('Password not right');
        } else {
            setUserIdForCookie(req, 'FloorKraken');
            res.send({ok: 'ok'});
        }
    }

    getStuff(req, res) {
        let stuff = dbService.getStuff();
        res.send(stuff);
    }

    getById(req, res) {
        let id = req.params.id;
        let type = +req.params.type;
        let object = dbService.findItemById(id, type);
        res.send(object);
    }

    saveGroup(req, res) {
        let id = req.params.id;
        let newName = req.body.name;
        let object = dbService.saveGroup(id, newName);
        res.send(object);
    }

    saveGroupForItem(req, res) {
        let id = req.params.id;
        let groupId = req.body.groupId;
        let type = +req.params.type;
        let object = dbService.saveGroupForItem(id, groupId, type);
        res.send(object);
    }

    saveNameForItem(req, res) {
        let id = req.params.id;
        let newName = req.body.name;
        let type = +req.params.type;
        let object = dbService.saveNameForItem(id, newName, type);
        res.send(object);
    }

}
export const mainController = new MainController();