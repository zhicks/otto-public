declare const io;
declare const $;

console.log('wat');
let $canvas;
let canvasContext;

const socket = io();

socket.emit('browser', () => {

});

socket.on('test', (msg) => {
    console.log('test', msg);
});

socket.on('data', (msg: { image: any, data: { keypoints: { score: number, part: string, position: { x: number, y: number } }[], score: number } }) => {
    console.log(msg);
    if (canvasContext) {
        let image = msg.image;
        var arrayBufferView = new Uint8Array( image );
        var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
        var imageUrl = URL.createObjectURL( blob );
        var img = new Image;
        img.src = imageUrl;
        img.onload = function(){
            // ctx.drawImage(img,0,0); // Or at whatever offset you like
            canvasContext.drawImage(img, 0, 0, 513, 513);
        };
        $('#imggg')[0].src=img.src;
    }
});

$(document).ready(() => {
    $canvas = $('#maincanvas');
    // $canvas.width(513);
    // $canvas.height(513);
    $canvas[0].width = 513;
    $canvas[0].height = 513;
    canvasContext = $canvas[0].getContext('2d');
});