"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var main_controller_1 = require("./controllers/main-controller");
var db_service_1 = require("./data/db-service");
var socket_control_1 = require("./socket/socket-control");
var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var swig = require('swig');
var bodyParser = require('body-parser');
var request = require('request');
var sessions = require('client-sessions');
// ------------------------------------------------------------------- Setup
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
swig.setDefaults({ cache: false, varControls: ['[[', ']]'] });
app.set('views', path.join(__dirname, './static-views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('port', (process.env.PORT || 3500));
// ------------------------------------------------------------------- Cors
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
// ------------------------------------------------------------------- Cookie
app.use(sessions({
    cookieName: 'ottoCookie',
    secret: 'apdfjio3r209rw09fajsfhw4arjhiowafd',
    duration: 30 * 24 * 60 * 60 * 1000,
    activeDuration: 30 * 24 * 60 * 60 * 1000 // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
}));
// ------------------------------------------------------------------- 'DB'
db_service_1.dbService.init();
// ------------------------------------------------------------------- Static Files
app.use('/assets', express.static(path.join(__dirname, './assets')));
app.use('/styles', express.static(path.join(__dirname, './styles')));
// app.use('/vendor', express.static(path.join(__dirname, '../shared/vendor-public')));
app.use('/dashboard', main_controller_1.checkAuthenticated, express.static(path.join(__dirname, '../otto-dash-client/dist')));
app.use('/dashboard/*', main_controller_1.checkAuthenticated, express.static(path.join(__dirname, '../otto-dash-client/dist')));
// ------------------------------------------------------------------- Page Routing
app.get('/login', function (req, res) {
    res.render('login.html', {});
});
app.get('/', function (req, res) {
    if (!main_controller_1.isUserLoggedIn(req)) {
        res.redirect('/login');
    }
    else {
        res.redirect('/dashboard');
    }
});
// ------------------------------------------------------------------- API Routing
app.post('/auth/login', main_controller_1.mainController.login.bind(main_controller_1.mainController));
app.get('/api/stuff', main_controller_1.checkAuthenticated, main_controller_1.mainController.getStuff.bind(main_controller_1.mainController));
app.get('/api/stuff/:type/:id', main_controller_1.checkAuthenticated, main_controller_1.mainController.getById.bind(main_controller_1.mainController));
app.post('/api/group', main_controller_1.checkAuthenticated, main_controller_1.mainController.saveGroup.bind(main_controller_1.mainController));
app.post('/api/group/:id', main_controller_1.checkAuthenticated, main_controller_1.mainController.saveGroup.bind(main_controller_1.mainController));
app.post('/api/:type/:id/name', main_controller_1.checkAuthenticated, main_controller_1.mainController.saveNameForItem.bind(main_controller_1.mainController));
app.post('/api/:type/:id/group', main_controller_1.checkAuthenticated, main_controller_1.mainController.saveGroupForItem.bind(main_controller_1.mainController));
app.post('/api/updateprogram', main_controller_1.checkAuthenticated, main_controller_1.mainController.updateProgram.bind(main_controller_1.mainController));
// ------------------------------------------------------------------- Handle 500
app.use(function (error, req, res, next) {
    res.status(500).send('Oops! Something went wrong');
});
// ------------------------------------------------------------------- Server
http.listen(app.get('port'), function () {
    console.log('listening on ' + app.get('port'));
});
// ------------------------------------------------------------------- Exit on keypress
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', process.exit.bind(process, 0));
// ------------------------------------------------------------------- Socket
socket_control_1.socketControl.init(http);
