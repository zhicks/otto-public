module SatelliteSshShare {
    declare const require;
    let fs = require('fs');
    let express = require('express');
    let app = express();
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');
    const SOCKET_ADDRESS = 'http://192.168.1.102:3500';
    const SSH_FILE_PATH = '~/.ssh/id_rsa.pub';
    let cloudSocket: any;

    cloudSocket = socketIoClient(SOCKET_ADDRESS);
    cloudSocket.on('connect', () => {
        console.log('connection');
        let idrsaContent = fs.readFileSync(SSH_FILE_PATH).toString();
        cloudSocket.emit('satellite_idrsa', idrsaContent);
    });
}