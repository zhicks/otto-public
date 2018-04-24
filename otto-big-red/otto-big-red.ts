declare const require;
declare const __dirname;
declare const process;

module OttoBigRed {
    let path = require('path');
    let express = require('express');
    let app = express();
    let http = require('http').Server(app);
    let socketIoClient = require('socket.io-client');

// ------------------------------------------------------------------- Constants
    const SOCKET_ADDRESS = 'http://localhost:3500';
    let hueHubAddress = 'http://192.168.1.111';
// TODO When you are ready to make a production app you will need to discover the bridge automatically using the Hue Bridge Discovery Guide or the tools provided with the official Philips Hue SDKs

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
        cloudSocket.emit('bigred', {
            id: 'boop'
        });
    });

    cloudSocket.on('do_discover_bulbs', () => {

    });

    cloudSocket.on('get_bulb_statuses', () => {

    });

    cloudSocket.on('turn_light_on', (idObj: {id: string}) => {

    });

    cloudSocket.on('turn_light_off', (idObj: {id: string}) => {

    });

}











