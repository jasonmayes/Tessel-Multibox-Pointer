'use strict'

var fs = require('fs');
var cp = require('child_process');
var Jimp = require('jimp');
var ws = require('nodejs-websocket');

// var childProcess = cp.spawn('./darknet', ['detect', 'cfg/tiny-yolo-voc.cfg', 'weights/tiny-yolo-voc.weights']);
var childProcess = cp.spawn('./darknet', ['detect', 'cfg/yolo.cfg', 'weights/yolo.weights']);

childProcess.stdout.setEncoding('utf8');

var gotLastResult = true;
// Use RAM disk to avoid large cloud write latency to disk. 20ms vs 100ms.
var dir = '/mnt/RAM_disk/';
var currentFile = 'data/horses.jpg\n';
var lastClassification = {timestamp: 0, results:[]};
var serverCreated = false;
var port = 1337;
var connection = null;
var receivedFrames = 0;
var framesProcessed = 0;
var mlReady = false;
var init = false;

childProcess.stdout.on('data', function(data) {
  // Get string back and split on new lines.
  var blobLines = data.split('\n');

  // If more than 1 line in result, we have classifications to deal with!
  if (blobLines.length > 1) {
    var odd = true;
    var cn = 0;

    lastClassification.results = [];

    // Loop through all lines from DarkNet results and find classification and co-ords.
    for (var i = 1; i < blobLines.length - 1; i++) {
      if (!odd) {
        // console.log(blobLines[i]);
        var coords = blobLines[i].split(', ');
        lastClassification.results[cn].position.x = parseInt(coords[0], 10);
        lastClassification.results[cn].position.width = parseInt(coords[1], 10);
        lastClassification.results[cn].position.y = parseInt(coords[2], 10);
        lastClassification.results[cn].position.height = parseInt(coords[3], 10);
        // console.log(lastClassification.results[cn].position);
        cn++;
      } else {
        console.log('\nClassification: ' + blobLines[i]);
        var tuple = blobLines[i].split(': ');
        lastClassification.results.push({name: tuple[0],
            percent: parseInt(tuple[1].split('%')[0], 10), position: {}});
      }
      odd = !odd;
    }
    // console.log(lastClassification.results);
    if (serverCreated) {
      connection.sendText(JSON.stringify(lastClassification));
    }
  } else {
    mlReady = true;
    if (!init) {
      childProcess.stdin.write(currentFile);
      init = true;
    }
  }
  // childProcess.stdin.end();
});


// Create the websocket server, provide connection callback
var server = ws.createServer(function (conn) {
  console.log("New connection");
  serverCreated = true;
  connection = conn;

  conn.on('text', function (data) {
    var timestamp = Date.now();
    serverCreated = true;

    lastClassification.timestamp = timestamp;

    // var strippedData = data.replace(/^data:image\/\w+;base64,/, '');
    var latency = Date.now();

    // Write received image to disk.
    fs.writeFile(dir + timestamp + '.jpg', data, {encoding: 'base64'}, function (err){
      if (err !== null) {
        console.error(err);
      }

      // Use Jimp to detect if image is mal formatted.
      Jimp.read(dir + timestamp + '.jpg').then(function (image) {
        currentFile = dir + timestamp + '.jpg\n';
        console.log('Write/Read latency: ' + (Date.now() - latency));
        if (mlReady) {
          console.log('\n--------------------------------------------------------------------------');
          console.log('Processing: ' + currentFile);
          mlReady = false;
          childProcess.stdin.write(currentFile);
          framesProcessed++;
        }
      }).catch(function (err) {
        // Bad JPG format, just reply with last known classification.
        console.log('\n' + err);
        if (serverCreated) {
          connection.sendText(JSON.stringify(lastClassification));
        }
      });
    });

    receivedFrames++;
    console.log('\n*******************************************');
    console.log('* Received new image: ' + timestamp + '     *');
    console.log('*******************************************\n');
  });


  // When the client closes the connection, notify us
  conn.on('close', function (code, reason) {
      console.log('Connection closed');
    serverCreated = false;
  });
}).listen(port);


function fpsTracker() {
  console.log('\n\n***** Actual FPS: ' + framesProcessed + ' Possible FPS: ' +
      receivedFrames);
  framesProcessed = 0;
  receivedFrames = 0;
}

setInterval(fpsTracker, 1000);

console.log('listening on port', port);
