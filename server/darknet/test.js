var cp = require('child_process');
var childProcess = cp.spawn('./darknet', ['detect', './cfg/yolo.cfg',
    './weights/darknetyolo.weights']);

childProcess.stdout.setEncoding('utf8');

childProcess.stdout.on("data", function(data) {
  var blobLines = data.split('\n');

  if (blobLines.length > 1) {
    var odd = true;
    for (var i = 1; i < blobLines.length - 1; i++) {
      if (!odd) {
        console.log(blobLines[i]);
      } else {
        console.log('Classification: ' + blobLines[i]);
      }
      odd = !odd;
    }
  }

  // Classify next image...
  childProcess.stdin.write('./darknet/data/horses.jpg\n');
  // childProcess.stdin.end();
});

childProcess.stdin.on("error", function (e)
{
  console.log("STDIN ON ERROR");
  console.log(e);
  //  childProcess.stdin.write('data/horses.jpg\n');
});
