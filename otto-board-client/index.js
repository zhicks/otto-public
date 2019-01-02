// get this to run a server
// get it to pull this code down and augment as we go
// make it run at startup

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let socketIoClient = require('socket.io-client');

console.log(process.argv);

const SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? 'http://blackboxjs.com:3500': 'http://192.168.1.112:3500';
console.log('socket address is ', SOCKET_ADDRESS);

let cloudSocket;

cloudSocket = socketIoClient(SOCKET_ADDRESS);
cloudSocket.on('connect', () => {
    console.log('connection');
    cloudSocket.emit('kathleen_board', {
        id: 'bigred'
    });
});

app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
console.log('server started');


