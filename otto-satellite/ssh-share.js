var SatelliteSshShare;
(function (SatelliteSshShare) {
    var fs = require('fs');
    var express = require('express');
    var app = express();
    var http = require('http').Server(app);
    var socketIoClient = require('socket.io-client');
    var SOCKET_ADDRESS = 'http://192.168.1.102:3500';
    var SSH_FILE_PATH = '../../.ssh/id_rsa.pub';
    var cloudSocket;
    cloudSocket = socketIoClient(SOCKET_ADDRESS);
    cloudSocket.on('connect', function () {
        console.log('connection');
        var idrsaContent = fs.readFileSync(SSH_FILE_PATH).toString();
        cloudSocket.emit('satellite_idrsa', idrsaContent);
    });
})(SatelliteSshShare || (SatelliteSshShare = {}));
