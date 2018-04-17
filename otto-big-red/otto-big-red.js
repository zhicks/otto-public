var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var socketIoClient = require('socket.io-client');
// ------------------------------------------------------------------- Constants
var SOCKET_ADDRESS = 'http://localhost:3500';
// ------------------------------------------------------------------- Props
var cloudSocket;
// ------------------------------------------------------------------- Init
app.set('view engine', 'html');
app.set('port', (process.env.PORT || 3501));
http.listen(app.get('port'), function () {
    console.log('listening on ' + app.get('port'));
});
console.log('big red server started');
cloudSocket = socketIoClient(SOCKET_ADDRESS);
cloudSocket.on('connect', function () {
    console.log('connection');
    cloudSocket.emit('satellite', {
        id: 'boop'
    });
});
