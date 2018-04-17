import {checkAuthenticated, isUserLoggedIn, mainController} from "./controllers/main-controller";
import {dbService} from "./data/db-service";
import {socketControl} from "./socket/socket-control";

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let swig = require('swig');
let bodyParser = require('body-parser');
let request = require('request');
let sessions = require('client-sessions');
declare const require;
declare const __dirname;
declare const process;
// ------------------------------------------------------------------- Setup
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
swig.setDefaults({ cache: false, varControls: ['[[', ']]'] });
app.set('views', path.join(__dirname, './static-views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('port', (process.env.PORT || 3500));
// ------------------------------------------------------------------- Cors
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
// ------------------------------------------------------------------- Cookie
app.use(sessions({
    cookieName: 'ottoCookie', // cookie name dictates the key name added to the request object
    secret: 'apdfjio3r209rw09fajsfhw4arjhiowafd', // should be a large unguessable string
    duration: 30 * 24 * 60 * 60 * 1000, // how long the session will stay valid in ms
    activeDuration: 30 * 24 * 60 * 60 * 1000 // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
}));
// ------------------------------------------------------------------- 'DB'
dbService.init();
// ------------------------------------------------------------------- Static Files
app.use('/assets', express.static(path.join(__dirname, './assets')));
app.use('/styles', express.static(path.join(__dirname, './styles')));
// app.use('/vendor', express.static(path.join(__dirname, '../shared/vendor-public')));
app.use('/dashboard', checkAuthenticated, express.static(path.join(__dirname, '../otto-dash-client/dist')));
app.use('/dashboard/*', checkAuthenticated, express.static(path.join(__dirname, '../otto-dash-client/dist')));
// ------------------------------------------------------------------- Page Routing
app.get('/login', (req, res) => {
    res.render('login.html', {});
});
app.get('/', (req, res) => {
    if (!isUserLoggedIn(req)) {
        res.redirect('/login');
    } else {
        res.redirect('/dashboard');
    }
});
// ------------------------------------------------------------------- API Routing
app.post('/auth/login', mainController.login.bind(mainController));
app.get('/api/stuff', checkAuthenticated, mainController.getStuff.bind(mainController));
app.get('/api/stuff/:type/:id', checkAuthenticated, mainController.getById.bind(mainController));
app.post('/api/group', checkAuthenticated, mainController.saveGroup.bind(mainController));
app.post('/api/group/:id', checkAuthenticated, mainController.saveGroup.bind(mainController));
app.post('/api/:type/:id/name', checkAuthenticated, mainController.saveNameForItem.bind(mainController));
app.post('/api/:type/:id/group', checkAuthenticated, mainController.saveGroupForItem.bind(mainController));
// ------------------------------------------------------------------- Handle 500
app.use((error, req, res, next) => {
    res.status(500).send('Oops! Something went wrong');
});
// ------------------------------------------------------------------- Server
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
// ------------------------------------------------------------------- Exit on keypress
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', process.exit.bind(process, 0));
// ------------------------------------------------------------------- Socket
socketControl.init(http);