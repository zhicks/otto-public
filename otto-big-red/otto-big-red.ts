declare const require;
declare const __dirname;
declare const process;
let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let socketIoClient = require('socket.io-client');

// ------------------------------------------------------------------- Constants
const SOCKET_ADDRESS = 'http://localhost:3500';

// ------------------------------------------------------------------- Props
let cloudSocket: any;

// ------------------------------------------------------------------- Init
app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
console.log('big red server started');

cloudSocket = socketIoClient(SOCKET_ADDRESS);
cloudSocket.on('connect', () => {
    console.log('connection');
    cloudSocket.emit('satellite', {
        id: 'boop'
    });
});
