declare const require;
const uuidv4 = require('uuid/v4');
const socketIo = require('socket.io');

class SocketControl {
    bigRed: any;
    satellites: any[] = [];

    init(http: any) {
        let io = socketIo(http);
        io.on('connection', socket => {
            console.log('connection');
            socket.on('bigred', () => {
                console.log('big red connected');
                this.bigRed = socket;
                this.bigRed.bigRed = true;
            });
            socket.on('satellite', (idObj: {id: string}) => {
                console.log('satellite connected with id', idObj.id);
                this.satellites.push(socket);
                socket.satellite = true;
                socket.satelliteId = idObj.id;
            });
            socket.on('disconnect', () => {
                console.log('socket disconnect');
                if (socket.bigRed) {
                    this.bigRed = null;
                    console.log('big red disconnect');
                }
                if (socket.satellite) {
                    console.log('socket is satellite', socket.satelliteId);
                    for (let i = 0; i < this.satellites.length; i++) {
                        let sat = this.satellites[i];
                        if (sat.satelliteId === socket.satelliteId) {
                            this.satellites.splice(i, 1);
                            console.log('satellite removed');
                            break;
                        }
                    }
                }
                console.log('satellites:');
                console.log(this.satellites);
            });
        });
    }
}

export const socketControl = new SocketControl();