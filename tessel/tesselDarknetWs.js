var tessel = require('tessel');
var av = require('tessel-av');
var path = require('path');
var servolib = require('servo-pca9685');
var ws = require("nodejs-websocket");


// REPLACE THIS WITH YOUR SERVER DETAILS.
var SERVER_URL = "ws://YOUR_SERVER_IP:1337/";
// This is the object classification name from darknet.
var LOOKING_FOR = 'person';



function Servo(port, servoPosition) {
  this.servo = servolib.use(tessel.port[port]);
  // Servo plugged in at position 1.
  this.servoLine = servoPosition;
  this.left = 0;
  this.right = 1;
  this.increment = 0.1;
  this.position = 0;
  this.ready = false;
  this.servo.on('ready', this.onReady.bind(this));
}


Servo.prototype.onReady = function() {
  this.ready = true;
  //  Set the minimum and maximum duty cycle for servo 1.
  //  If the servo doesn't move to its full extent or stalls out
  //  and gets hot, try tuning these values (0.05 and 0.12).
  //  Moving them towards each other = less movement range
  //  Moving them apart = more range, more likely to stall and burn out
  this.servo.configure(this.servoLine, 0.05, 0.12, function () {
    //  Set servo #1 to position pos.
    this.servo.move(this.servoLine, this.position);
  }.bind(this));
};


Servo.prototype.move = function(position) {
  if (this.ready) {
    this.servo.move(this.servoLine, position);
  }
};



// We can use the speaker to speak what we see!
var speaker = new av.Speaker();
var speakerEnded = true;

speaker.on('ended', function() {
  speakerEnded = true;
});

var servo1 = new Servo('A', 1);
var lastTimestamp = 0;

var gotLast = true;
var soundFinished = true;

var camera = new av.Camera({
  fps: 15,
  dimensions: "320x240",
  quality: 50
});

var img = camera.stream();
img.on('data', processImage);

var connected = false;
var connection = ws.connect(SERVER_URL, function() {
  // When we connect to the server, send some catchy text
  console.log("Connected to web server.");
  connected = true;
});

var fps = 0;

connection.on('text', function(text) {
  gotLast = true;
  processResult(text);
  tessel.led[2].toggle();
});


function processResult(snapshot) {
  var jsonResponse = JSON.parse(snapshot);

  // Only accept responses if they occurred after our last response.
  if ((jsonResponse.timestamp > lastTimestamp)) {
    console.log(snapshot);

    var labels = jsonResponse.labels;
    var highest = {index: 0, value: 0, name: 'Class not detected', x: 0, y: 0};

    for (var n = 0; n < jsonResponse.results.length; n++) {
      if ((jsonResponse.results[n].name === LOOKING_FOR) &&
            jsonResponse.results[n].percent > highest.value) {
        highest.value = jsonResponse.results[n].percent;
        highest.name = jsonResponse.results[n].name;
        highest.x =  (jsonResponse.results[n].position.x +
            jsonResponse.results[n].position.width) / 2;
        highest.y =  (jsonResponse.results[n].position.y +
            jsonResponse.results[n].position.height) / 2;
        highest.index = n;
      }
    }

    // Print the name of the object that has highest probability.
    console.log(highest.name + '\n\n');

    // If we are not currently using speaker already, shout out what we can see!
    if (speakerEnded) {
      speaker.say('I can see ' + highest.name);
      speakerEnded = false;
    }

    // Toggle LED as a visual indicator that we processed a result.
    tessel.led[3].off();

    // If the highest result is the object type wanted to find, toggle LED
    // and move servo to point at it.
    if (highest.name === LOOKING_FOR) {
      tessel.led[3].toggle();
      var rot = (1 - (highest.x / 640));
      rot = rot > 0.5 ? rot - 0.2 :  rot + 0.2;
      servo1.move(rot);
    }
  }

  lastTimestamp = jsonResponse.timestamp;
}


function processImage(data) {
  fps++;
  if (connected && gotLast) {
    tessel.led[2].off();
    connection.sendText(data.toString('base64'));
    gotLast = false;
  }
}


// Print out the currently estimated frames per second processed every second.
setInterval(fpsFunc, 1000);

function fpsFunc() {
  console.log(fps);
  fps = 0;
}
