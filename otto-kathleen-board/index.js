// make it run at startup
// should probably backup the actual C++ soon
// get it on blackbox
// pretty it up
// the saved screen should display the text
// font size

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let socketIoClient = require('socket.io-client');
const { exec } = require('child_process');
var os = require('os');
var ifaces = os.networkInterfaces();

const API_PATH = '/home/pi/NEW_rpi-rgb-led-matrix/examples-api-use';
const NUM_ROWS = 32;
const BRIGHTNESS = 50;
const CLOCK_TIMEOUT_AMOUNT = 20 * 60 * 60 * 1000;
let clockTimeout;

console.log(process.argv);

let ipAddress = '';

Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }

        if (alias >= 1) {
            // this single interface has multiple ipv4 addresses
            console.log(ifname + ':' + alias, iface.address);
        } else {
            // this interface has only one ipv4 adress
            console.log(ifname, iface.address);
            ipAddress = iface.address;
        }
        ++alias;
    });
});

const SOCKET_ADDRESS = process.argv && process.argv[2] && process.argv[2].indexOf('prod') !== -1 ? 'http://blackboxjs.com:3500': 'http://192.168.1.112:3500';
console.log('socket address is ', SOCKET_ADDRESS);


function writeText(str) {
    // remember if you change the C++, cd into that directory and HARDWARE=adafruit-hat make
    // const args = [`echo "" | ${API_PATH}/text-example`, text, filename, ledRows];
    // return spawnSync('python', args);
    const command = `echo "${str}" | ${API_PATH}/text-example -f ${API_PATH}/../fonts/4x6.bdf --led-rows=${NUM_ROWS} -b ${BRIGHTNESS}`;
    exec(command, function(error, stdout, stderr) {
    	//console.log('error', error);
	    //console.log('stdout', stdout);
	    //console.log('stderr', stderr);
    });
}

function displayTime() {
    killProcess('clock');
    killProcess(`text-example`);
    const cmdDisplayClock = `${API_PATH}/clock -f ${API_PATH}/../fonts/5x8.bdf -d "%I:%M" -y 11 -x 3 --led-rows=${NUM_ROWS} -b ${BRIGHTNESS} -C 255,255,255`;
    const child = exec(cmdDisplayClock);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
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
    cloudSocket.on('giveIp', function() {
       cloudSocket.emit('kathleen_board_ip', ipAddress);
    });
    cloudSocket.emit('kathleen_board', {
        ip: ipAddress
    });
	cloudSocket.on('displayClock', function() {
		killProcess('clock');
		killProcess('text-example');
		displayTime();
	});
    cloudSocket.on('message', function(message) {
       console.log(message);
       killProcess('clock');
	    killProcess(`text-example`);
	    writeText(message);

	    clearTimeout(clockTimeout);
	    clockTimeout = setTimeout(function() {
	        displayTime();
        }, CLOCK_TIMEOUT_AMOUNT);

    });
});

app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});
console.log('server started');
displayTime();

