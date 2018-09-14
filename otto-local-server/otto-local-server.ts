import { ottoLocalSocket } from "./otto-local-socket";

declare const require;
declare const __dirname;
declare const process;
declare const global;

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let swig = require('swig');
let bodyParser = require('body-parser');
let fs = require('fs');
const tf = require('@tensorflow/tfjs');
const tfjsnode = require('@tensorflow/tfjs-node');
let posenet = require('@tensorflow-models/posenet');
let XMLHttpRequest = require('xhr2');
global['XMLHttpRequest'] = XMLHttpRequest;

// Next is getting events from the RPI
// Should be pretty simple in the same way it's already doing it
// Should be no need for socket io client on big red for this local file

// ------------------------------------------------------------------- Setup
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
swig.setDefaults({ cache: false, varControls: ['[[', ']]'] });
app.set('views', path.join(__dirname, '../otto-local-client'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('port', (process.env.PORT || 3505));
// ------------------------------------------------------------------- Cors
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
// ------------------------------------------------------------------- Static Files
app.use('/assets', express.static(path.join(__dirname, '../otto-local-client/assets')));
app.use('/styles', express.static(path.join(__dirname, '../otto-local-client/styles')));
// ------------------------------------------------------------------- Routing
app.get('/', (req, res) => {
    res.render('index.html');
});
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});

console.log('hi local server');

ottoLocalSocket.init(http, posenet, tf);
posenet.load().then(function(net) {
    // console.log('hey tf is ', tf);

    // ------------------------------------------------------------------- Temporary testing
    let imageData = fs.readFileSync('frisbee_2.jpg');
    setInterval(() => {
        console.log('sending image');
        ottoLocalSocket.asdf(net, imageData);
    }, 3000);
});


