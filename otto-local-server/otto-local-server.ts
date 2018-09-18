import { ottoLocalSocket } from "./otto-local-socket";

declare const require;
declare const __dirname;
declare const process;
declare const global;

let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let swig = require('swig');
let bodyParser = require('body-parser');
let fs = require('fs');
const tf = require('@tensorflow/tfjs');
const tfjsnode = require('@tensorflow/tfjs-node');
let posenet = require('@tensorflow-models/posenet');
let XMLHttpRequest = require('xhr2');
global['XMLHttpRequest'] = XMLHttpRequest;

// Next is getting events from the RPI
// Should be pretty simple in the same way it's already doing it
// Should be no need for socket io client on big red for this local file

// ------------------------------------------------------------------- Setup
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
swig.setDefaults({ cache: false, varControls: ['[[', ']]'] });
app.set('views', path.join(__dirname, '../otto-local-client'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('port', (process.env.PORT || 3505));
// app.use(function(req, res, next) {
//     var contentType = req.headers['content-type'] || ''
//     var mime = contentType.split(';')[0];
//     // Only use this middleware for content-type: application/octet-stream
//     if(mime != 'application/octet-stream') {
//         return next();
//     }
//     var data = '';
//     req.setEncoding('binary');
//     req.on('data', function(chunk) {
//         data += chunk;
//     });
//     req.on('end', function() {
//         console.log('raw body');
//         req.rawBody = data;
//         next();
//     });
// });
// ------------------------------------------------------------------- Cors
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
// ------------------------------------------------------------------- Static Files
app.use('/assets', express.static(path.join(__dirname, '../otto-local-client/assets')));
// ------------------------------------------------------------------- Routing
app.get('/', (req, res) => {
    res.render('index.html');
});
http.listen(app.get('port'), () => {
    console.log('listening on ' + app.get('port'));
});

// ------------------------------------------------------------------- Socket
ottoLocalSocket.init(http, posenet, tf);
// ------------------------------------------------------------------- Gesture

// ------------------------------------------------------------------- Temporary testing
// posenet.load().then(function(net) {
//     console.log('posenet loaded');
//     ottoLocalSocket.setPosenetLocalInstance(net);
//     // let imageData = fs.readFileSync('frisbee_2.jpg');
//     // let imageData2 = fs.readFileSync('frisbee.jpg');
//     // let x = false;
//     // setInterval(() => {
//     //     console.log('sending image');
//     //     if (!x) {
//     //         ottoLocalSocket.onImage(imageData);
//     //     } else {
//     //         ottoLocalSocket.onImage(imageData2);
//     //     }
//     //     x = !x;
//     // }, 3000);
// });

// ------------------------------------------------------------------- Test
var ip = '127.0.0.1';

const LiveCam = require('livecam');
const webcam_server = new LiveCam
({
    // address and port of the webcam UI
    'ui_addr' : ip,
    'ui_port' : 11000,

    // address and port of the webcam Socket.IO server
    // this server broadcasts GStreamer's video frames
    // for consumption in browser side.
    'broadcast_addr' : ip,
    'broadcast_port' : 12000,

    // address and port of GStreamer's tcp sink
    'gst_tcp_addr' : ip,
    'gst_tcp_port' : 10000,

    // callback function called when server starts
    'start' : function() {
        console.log('WebCam server started!');
    },

    // webcam object holds configuration of webcam frames
    'webcam' : {

        // should frames be converted to grayscale (default : false)
        'grayscale' : false,

        // should width of the frame be resized (default : 0)
        // provide 0 to match webcam input
        'width' : 0,

        // should height of the frame be resized (default : 0)
        // provide 0 to match webcam input
        'height' : 0,

        // should a fake source be used instead of an actual webcam
        // suitable for debugging and development (default : false)
        'fake' : false,

        // framerate of the feed (default : 0)
        // provide 0 to match webcam input
        'framerate' : 25
    }
});

webcam_server.broadcast();



//
// const something = {
//     "MobilenetV1/Conv2d_0/biases": {
//         "filename": "MobilenetV1_Conv2d_0_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/Conv2d_0/weights": {
//         "filename": "MobilenetV1_Conv2d_0_weights",
//         "shape": [
//             3,
//             3,
//             3,
//             32
//         ]
//     },
//     "MobilenetV1/Conv2d_10_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_10_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_10_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_10_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_10_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_10_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_10_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_10_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_11_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_11_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_11_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_11_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_11_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_11_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_11_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_11_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_12_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_12_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_12_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_12_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_12_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_12_pointwise_biases",
//         "shape": [
//             1024
//         ]
//     },
//     "MobilenetV1/Conv2d_12_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_12_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             1024
//         ]
//     },
//     "MobilenetV1/Conv2d_13_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_13_depthwise_biases",
//         "shape": [
//             1024
//         ]
//     },
//     "MobilenetV1/Conv2d_13_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_13_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             1024,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_13_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_13_pointwise_biases",
//         "shape": [
//             1024
//         ]
//     },
//     "MobilenetV1/Conv2d_13_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_13_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             1024
//         ]
//     },
//     "MobilenetV1/Conv2d_1_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_1_depthwise_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/Conv2d_1_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_1_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             32,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_1_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_1_pointwise_biases",
//         "shape": [
//             64
//         ]
//     },
//     "MobilenetV1/Conv2d_1_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_1_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             32,
//             64
//         ]
//     },
//     "MobilenetV1/Conv2d_2_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_2_depthwise_biases",
//         "shape": [
//             64
//         ]
//     },
//     "MobilenetV1/Conv2d_2_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_2_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             64,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_2_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_2_pointwise_biases",
//         "shape": [
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_2_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_2_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             64,
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_3_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_3_depthwise_biases",
//         "shape": [
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_3_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_3_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             128,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_3_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_3_pointwise_biases",
//         "shape": [
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_3_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_3_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             128,
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_4_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_4_depthwise_biases",
//         "shape": [
//             128
//         ]
//     },
//     "MobilenetV1/Conv2d_4_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_4_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             128,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_4_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_4_pointwise_biases",
//         "shape": [
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_4_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_4_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             128,
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_5_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_5_depthwise_biases",
//         "shape": [
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_5_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_5_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             256,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_5_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_5_pointwise_biases",
//         "shape": [
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_5_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_5_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             256,
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_6_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_6_depthwise_biases",
//         "shape": [
//             256
//         ]
//     },
//     "MobilenetV1/Conv2d_6_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_6_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             256,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_6_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_6_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_6_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_6_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             256,
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_7_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_7_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_7_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_7_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_7_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_7_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_7_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_7_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_8_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_8_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_8_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_8_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_8_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_8_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_8_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_8_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_9_depthwise/biases": {
//         "filename": "MobilenetV1_Conv2d_9_depthwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_9_depthwise/depthwise_weights": {
//         "filename": "MobilenetV1_Conv2d_9_depthwise_depthwise_weights",
//         "shape": [
//             3,
//             3,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/Conv2d_9_pointwise/biases": {
//         "filename": "MobilenetV1_Conv2d_9_pointwise_biases",
//         "shape": [
//             512
//         ]
//     },
//     "MobilenetV1/Conv2d_9_pointwise/weights": {
//         "filename": "MobilenetV1_Conv2d_9_pointwise_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             512
//         ]
//     },
//     "MobilenetV1/displacement_bwd_1/biases": {
//         "filename": "MobilenetV1_displacement_bwd_1_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/displacement_bwd_1/weights": {
//         "filename": "MobilenetV1_displacement_bwd_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             32
//         ]
//     },
//     "MobilenetV1/displacement_bwd_2/biases": {
//         "filename": "MobilenetV1_displacement_bwd_2_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/displacement_bwd_2/weights": {
//         "filename": "MobilenetV1_displacement_bwd_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             32
//         ]
//     },
//     "MobilenetV1/displacement_fwd_1/biases": {
//         "filename": "MobilenetV1_displacement_fwd_1_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/displacement_fwd_1/weights": {
//         "filename": "MobilenetV1_displacement_fwd_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             32
//         ]
//     },
//     "MobilenetV1/displacement_fwd_2/biases": {
//         "filename": "MobilenetV1_displacement_fwd_2_biases",
//         "shape": [
//             32
//         ]
//     },
//     "MobilenetV1/displacement_fwd_2/weights": {
//         "filename": "MobilenetV1_displacement_fwd_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             32
//         ]
//     },
//     "MobilenetV1/heatmap_1/biases": {
//         "filename": "MobilenetV1_heatmap_1_biases",
//         "shape": [
//             17
//         ]
//     },
//     "MobilenetV1/heatmap_1/weights": {
//         "filename": "MobilenetV1_heatmap_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             17
//         ]
//     },
//     "MobilenetV1/heatmap_2/biases": {
//         "filename": "MobilenetV1_heatmap_2_biases",
//         "shape": [
//             17
//         ]
//     },
//     "MobilenetV1/heatmap_2/weights": {
//         "filename": "MobilenetV1_heatmap_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             17
//         ]
//     },
//     "MobilenetV1/offset_1/biases": {
//         "filename": "MobilenetV1_offset_1_biases",
//         "shape": [
//             34
//         ]
//     },
//     "MobilenetV1/offset_1/weights": {
//         "filename": "MobilenetV1_offset_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             34
//         ]
//     },
//     "MobilenetV1/offset_2/biases": {
//         "filename": "MobilenetV1_offset_2_biases",
//         "shape": [
//             34
//         ]
//     },
//     "MobilenetV1/offset_2/weights": {
//         "filename": "MobilenetV1_offset_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             34
//         ]
//     },
//     "MobilenetV1/partheat_1/biases": {
//         "filename": "MobilenetV1_partheat_1_biases",
//         "shape": [
//             17
//         ]
//     },
//     "MobilenetV1/partheat_1/weights": {
//         "filename": "MobilenetV1_partheat_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             17
//         ]
//     },
//     "MobilenetV1/partheat_2/biases": {
//         "filename": "MobilenetV1_partheat_2_biases",
//         "shape": [
//             17
//         ]
//     },
//     "MobilenetV1/partheat_2/weights": {
//         "filename": "MobilenetV1_partheat_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             17
//         ]
//     },
//     "MobilenetV1/partoff_1/biases": {
//         "filename": "MobilenetV1_partoff_1_biases",
//         "shape": [
//             34
//         ]
//     },
//     "MobilenetV1/partoff_1/weights": {
//         "filename": "MobilenetV1_partoff_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             34
//         ]
//     },
//     "MobilenetV1/partoff_2/biases": {
//         "filename": "MobilenetV1_partoff_2_biases",
//         "shape": [
//             34
//         ]
//     },
//     "MobilenetV1/partoff_2/weights": {
//         "filename": "MobilenetV1_partoff_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             34
//         ]
//     },
//     "MobilenetV1/segment_1/biases": {
//         "filename": "MobilenetV1_segment_1_biases",
//         "shape": [
//             1
//         ]
//     },
//     "MobilenetV1/segment_1/weights": {
//         "filename": "MobilenetV1_segment_1_weights",
//         "shape": [
//             1,
//             1,
//             512,
//             1
//         ]
//     },
//     "MobilenetV1/segment_2/biases": {
//         "filename": "MobilenetV1_segment_2_biases",
//         "shape": [
//             1
//         ]
//     },
//     "MobilenetV1/segment_2/weights": {
//         "filename": "MobilenetV1_segment_2_weights",
//         "shape": [
//             1,
//             1,
//             1024,
//             1
//         ]
//     }
// };
//
// const baseUrlPath = 'https://storage.googleapis.com/tfjs-models/weights/posenet/mobilenet_v1_101/';
// const https = require('https');
// let numKeys = Object.keys(something).length;
// let numGotten = 0;
//
// function doSomething(url, filename, key) {
//     // https.get(url, resp => {
//     //     let data = '';
//     //
//     //     // A chunk of data has been recieved.
//     //     resp.on('data', (chunk) => {
//     //         data += chunk;
//     //     });
//     //
//     //     // The whole response has been received. Print out the result.
//     //     resp.on('end', () => {
//     //         // console.log(JSON.parse(data).explanation);
//     //         numGotten++;
//     //         console.log('data should be good, got ' + filename + ', ' + numGotten + ' out of ' + numKeys);
//     //         fs.writeFileSync('../otto-local-client/assets/model-stuff/' + filename, data);
//     //     });
//     // });
//     var xhr = new XMLHttpRequest();
//     // xhr.responseType = 'arraybuffer';
//     xhr.open('GET', url);
//     xhr.onload = function () {
//         numGotten++;
//         console.log('data should be good, got ' + filename + ', ' + numGotten + ' out of ' + numKeys);
//         fs.writeFileSync('../otto-local-client/assets/model-stuff/' + filename, xhr.response);
//     }
//     xhr.send();
// }
//
// let timeIncrease = 0;
// // let keys = Object.keys(something);
// // for (let i = 0; i < keys.length; i++) {
// //     let key = keys[i];
// //     const filename = something[key].filename;
// //     // console.log(filename);
// //     const url = baseUrlPath + filename;
// //     console.log(url);
// //     setTimeout(() => {
// //         console.log('doing ', filename);
// //         doSomething(url, filename, key);
// //     }, timeIncrease);
// //     timeIncrease += 800;
// // }
