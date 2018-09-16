var socketHandler;
var drawHandler;
var domHandler;
var SocketHandler = /** @class */ (function () {
    function SocketHandler() {
    }
    SocketHandler.prototype.init = function () {
        var socket = this.socket = io();
        socket.on('guiState', function (state) {
            domHandler.updateGuiStateFromSocket(state);
        });
        socket.on('data', function (msg) {
            domHandler.onData(msg);
        });
        socket.emit('browser');
    };
    return SocketHandler;
}());
var DrawHandler = /** @class */ (function () {
    function DrawHandler() {
        this.color = 'aqua';
    }
    DrawHandler.prototype.drawResults = function (canvas, poses, minPartConfidence, minPoseConfidence) {
        var _this = this;
        poses.forEach(function (pose) {
            if (pose.score >= minPoseConfidence) {
                if (domHandler.guiState.showKeypoints) {
                    _this.drawKeypoints(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
                }
                if (domHandler.guiState.showSkeleton) {
                    _this.drawSkeleton(pose.keypoints, minPartConfidence, canvas.getContext('2d'));
                }
            }
        });
    };
    DrawHandler.prototype.drawSkeleton = function (keypoints, minConfidence, ctx, scale) {
        var _this = this;
        if (scale === void 0) { scale = 1; }
        var adjacentKeyPoints = posenet.getAdjacentKeyPoints(keypoints, minConfidence);
        adjacentKeyPoints.forEach(function (keypoints) {
            _this.drawSegment(_this.toTuple(keypoints[0].position), _this.toTuple(keypoints[1].position), _this.color, scale, ctx);
        });
    };
    DrawHandler.prototype.drawKeypoints = function (keypoints, minConfidence, ctx, scale) {
        if (scale === void 0) { scale = 1; }
        for (var i = 0; i < keypoints.length; i++) {
            var keypoint = keypoints[i];
            if (keypoint.score < minConfidence) {
                continue;
            }
            var _a = keypoint.position, y = _a.y, x = _a.x;
            this.drawPoint(ctx, y * scale, x * scale, 3, this.color);
        }
    };
    DrawHandler.prototype.drawPoint = function (ctx, y, x, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    };
    DrawHandler.prototype.drawSegment = function (_a, _b, color, scale, ctx) {
        var ay = _a[0], ax = _a[1];
        var by = _b[0], bx = _b[1];
        var lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax * scale, ay * scale);
        ctx.lineTo(bx * scale, by * scale);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.stroke();
    };
    DrawHandler.prototype.toTuple = function (_a) {
        var y = _a.y, x = _a.x;
        return [y, x];
    };
    return DrawHandler;
}());
var DomHandler = /** @class */ (function () {
    function DomHandler() {
        this.guiState = {
            multiPoseDetection: {
                outputStride: 16,
                minPartConfidence: 0.1,
                minPoseConfidence: 0.1,
                scoreThreshold: 0.1,
                nmsRadius: 1.0,
                maxDetections: 1,
            },
            showKeypoints: false,
            showSkeleton: false
        };
    }
    DomHandler.prototype.init = function () {
        this.$canvas = $('#maincanvas');
        this.$canvas[0].width = 513;
        this.$canvas[0].height = 513;
        this.canvasContext = this.$canvas[0].getContext('2d');
        this.setupGui();
    };
    DomHandler.prototype.onData = function (msg) {
        var _this = this;
        console.log(msg);
        var image = msg.image;
        // let arrayBufferView = new Uint8Array( image );
        // let blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
        // let imageUrl = URL.createObjectURL( blob );
        // let img = new Image;
        // img.src = imageUrl;
        // img.onload = () => {
        //     const w = msg.data.imgDims.w;
        //     const h = msg.data.imgDims.h;
        //     this.$canvas[0].width = w;
        //     this.$canvas[0].height = h;
        //     this.canvasContext.drawImage(img, 0, 0, w, h);
        //     drawHandler.drawResults(this.$canvas[0], msg.data.poses, this.guiState.multiPoseDetection.minPartConfidence, this.guiState.multiPoseDetection.minPoseConfidence);
        // };
        var img = new Image;
        img.src = msg.data.img;
        img.onload = function () {
            var w = msg.data.imgDims.w;
            var h = msg.data.imgDims.h;
            _this.$canvas[0].width = w;
            _this.$canvas[0].height = h;
            _this.canvasContext.drawImage(img, 0, 0, w, h);
            drawHandler.drawResults(_this.$canvas[0], msg.data.poses, _this.guiState.multiPoseDetection.minPartConfidence, _this.guiState.multiPoseDetection.minPoseConfidence);
        };
    };
    DomHandler.prototype.setupGui = function () {
        var _this = this;
        var gui = this.gui = new dat.GUI();
        // Output stride:  Internally, this parameter affects the height and width of
        // the layers in the neural network. The lower the value of the output stride
        // the higher the accuracy but slower the speed, the higher the value the
        // faster the speed but lower the accuracy.
        var multiPoseDetection = gui.addFolder('Pose Estimation');
        multiPoseDetection.open();
        multiPoseDetection.add(this.guiState.multiPoseDetection, 'outputStride', [8, 16, 32]).onChange(function (outputStride) {
            _this.guiState.multiPoseDetection.outputStride = +outputStride;
            _this.sendGuiStateToServer();
        });
        // Pose confidence: the overall confidence in the estimation of a person's
        // pose (i.e. a person detected in a frame)
        // Min part confidence: the confidence that a particular estimated keypoint
        // position is accurate (i.e. the elbow's position)
        multiPoseDetection
            .add(this.guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0)
            .onChange(this.sendGuiStateToServer.bind(this));
        multiPoseDetection
            .add(this.guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0)
            .onChange(this.sendGuiStateToServer.bind(this));
        // nms Radius: controls the minimum distance between poses that are returned
        // defaults to 20, which is probably fine for most use cases
        multiPoseDetection.add(this.guiState.multiPoseDetection, 'nmsRadius', 0.0, 40.0)
            .onChange(this.sendGuiStateToServer.bind(this));
        multiPoseDetection.add(this.guiState.multiPoseDetection, 'maxDetections')
            .min(1)
            .max(20)
            .step(1)
            .onChange(this.sendGuiStateToServer.bind(this));
        var visual = gui.addFolder('Visual');
        visual.open();
        visual.add(this.guiState, 'showKeypoints').onChange(this.sendGuiStateToServer.bind(this));
        visual.add(this.guiState, 'showSkeleton').onChange(this.sendGuiStateToServer.bind(this));
    };
    DomHandler.prototype.updateGuiStateFromSocket = function (state) {
        console.log('updating gui state');
        for (var key in state) {
            if (typeof state[key] === 'object') {
                for (var key2 in state[key]) {
                    this.guiState[key][key2] = state[key][key2];
                }
            }
            else {
                this.guiState[key] = state[key];
            }
        }
        // Top level
        for (var i in domHandler.gui.__controllers) {
            this.gui.__controllers[i].updateDisplay();
        }
        // Folders
        for (var i in domHandler.gui.__folders) {
            for (var j in domHandler.gui.__folders[i].__controllers) {
                domHandler.gui.__folders[i].__controllers[j].updateDisplay();
            }
        }
        // Why is dat.gui like this
    };
    DomHandler.prototype.sendGuiStateToServer = function () {
        socketHandler.socket.emit('guiState', this.guiState);
    };
    return DomHandler;
}());
socketHandler = new SocketHandler();
drawHandler = new DrawHandler();
domHandler = new DomHandler();
$(document).ready(function () {
    domHandler.init();
    socketHandler.init();
});
