// get this to run a server
// make it broadcast IP
// get it to pull this code down and augment as we go
// make it run at startup

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let socketIoClient = require('socket.io-client');
const { exec } = require('child_process');

const API_PATH = '~/NEW_rpi-rgb-led-matrix/examples-api-use';

console.log(process.argv);

const SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? 'http://blackboxjs.com:3500': 'http://192.168.1.112:3500';
console.log('socket address is ', SOCKET_ADDRESS);


function writeText(str) {
    // remember if you change the C++, cd into that directory and HARDWARE=adafruit-hat make
    // const args = [`echo "" | ${API_PATH}/text-example`, text, filename, ledRows];
    // return spawnSync('python', args);
    const command = `echo "${str}" | ${API_PATH}/text-example -f ${API_PATH}/../fonts/4x6.bdf --led-rows=16 -b 50`;
    exec(command);
}

let cloudSocket;

cloudSocket = socketIoClient(SOCKET_ADDRESS);
cloudSocket.on('connect', () => {
    console.log('connection');
    cloudSocket.emit('kathleen_board', {
        id: 'kathleen_board'
    });
    cloudSocket.on('message', function(message) {
       console.log(message);



    });
});

app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
console.log('server started');


