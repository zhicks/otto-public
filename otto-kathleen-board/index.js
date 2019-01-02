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

const API_PATH = '/home/pi/NEW_rpi-rgb-led-matrix/examples-api-use';

console.log(process.argv);

const SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? 'http://blackboxjs.com:3500': 'http://192.168.1.112:3500';
console.log('socket address is ', SOCKET_ADDRESS);


function writeText(str) {
    // remember if you change the C++, cd into that directory and HARDWARE=adafruit-hat make
    // const args = [`echo "" | ${API_PATH}/text-example`, text, filename, ledRows];
    // return spawnSync('python', args);
    const command = `echo "${str}" | ${API_PATH}/text-example -f ${API_PATH}/../fonts/4x6.bdf --led-rows=16 -b 50`;
    exec(command, function(error, stdout, stderr) {
    	//console.log('error', error);
	    //console.log('stdout', stdout);
	    //console.log('stderr', stderr);
    });
}

function killProcess(grepPattern) {
	exec(`kill $(ps aux | grep '${grepPattern}' | awk '{print $2}')`, function(error, stdout, stderr) { 
		//console.log(error);
		//console.log(stdout);
		//console.log(stderr);
	});
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
	    killProcess(`text-example`);
	writeText(message);


    });
});

app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
console.log('server started');


