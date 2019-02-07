var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var socketIoClient = require('socket.io-client');
var exec = require('child_process').exec;

console.log('Starting otto work computer');

// var SOCKET_ADDRESS = 'http://blackboxjs.com:3500';
var SOCKET_ADDRESS = 'localhost:3500';
var START_CMD = 'autohotkey.exe C:\\Users\\Zack Hicks\\Misc\\mm.ahk';
var KILL_CMD = 'taskkill /F /IM autohotkey.exe /T';

var cloudSocket = socketIoClient(SOCKET_ADDRESS);
cloudSocket.on('mousemove_turn_on', () => {
    console.log('starting mm');
    exec(START_CMD);
});
cloudSocket.on('mousemove_turn_off', () => {
    console.log('stopping mm');
    exec(KILL_CMD);
});

cloudSocket.emit('workComputer');

app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3502));
http.listen(app.get('port'), function () {
    console.log('listening on ' + app.get('port'));
});