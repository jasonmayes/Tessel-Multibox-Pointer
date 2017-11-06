# Tessel-Multibox-Pointer
Use your Tessel with Google Compute Engine GPU instance running Darknet YOLO via a Node.js server to perform multibox detection over websockets. We can then point a servo at the object of interest and speak out what we see via the speaker.

![tessel-pointer](https://user-images.githubusercontent.com/4972997/32421324-1c905812-c24c-11e7-9ce4-43a9864eac45.gif)



## How to use this?

First head over to [cloud.google.com](https://cloud.google.com/compute/) or your favourite cloud compute provider and fire up a new GPU enabled instance running the latest Ubuntu LTS (my specs are shown below). In this example we will be using Google Compute Engine which offers powerful GPU enabled instances charged by the minute so it will cost you less so cheaper than AWS! Woohoo!

### Instance specs: 

- 1 VCPU
- NVidia Tesla K80 graphics card
- 8 GB RAM
- 10 GB disk (no need for SSD as we will be using a RAM disk to reduce latency).
- OS: Use the latest Ubuntu LTS from the default images.

Alright, now we have a server, clone this github repo!

```
git clone https://github.com/jasonmayes/Tessel-Multibox-Pointer.git
```

Once cloned, we will need to set up the OS so we can run Darknet YOLO (the awesome ML smarts we shall be using for multibox detection of humans in this case - this basically means it will find where in an image the human can be seen). I have included a modified version of the Darknet repo in this submit as by default it does not output the co-ordinates for the found objects. We need this! 

Darknet will run on CPU only if you dont have CUDA installed so the first thing you want to do is download and install CUDA so we can make use of that tasty GPU sitting in our box... Follow the NVIDIA instructions for doing that here: https://developer.nvidia.com/cuda-downloads

Once you have CUDA installed, lets install a RAM drive. This means we will emulate a hard drive in RAM. Why? Well when we receive images from our Tessel we want to be able to get as many FPS as possible so writing to a cloud connected HDD takes around 100ms. By writing it to RAM it takes closer to 15ms. As we dont care about persistance for image classifications, RAM is fine (obvviously anything written to this would not exist if power was shut down).

To install RAM drive do the following:

```
sudo mkdir /mnt/RAM_disk
sudo cp /etc/fstab /etc/fstab.bak
sudo nano /etc/fstab
```

Once nano opens, add the following line of code to the file and save it:

```
tmpfs     /mnt/RAM_disk     tmpfs     rw,size=1G,x-gvfs-show     0 0
```

Great! Now we have specified a 1GB RAM drive. Time to mount it so we can use it:

```
sudo mount -a
```

Huzzah! Assuming you copied everything correctly, my code will automatically write to this RAM disk you just created.

Time to fire up the Tessel Node.js web server that will do all the processing serverside... First ensure Node.js is installed:

```
sudo apt-get update
sudo apt-get install nodejs
sudo apt-get install nodejs-legacy
sudo apt-get install npm
```

Once installed we should be able to now run my node code (located in server/darknet/) using the following command:

```
node tesselws.js
```

Once this is running you must make sure any firewall policies for your Compute Engine instance allow access from the outside world to the port the Tessel server is running. By default we use port 1337 so make sure that is whitelisted on the Compute Engine firewall policies.

Great the last thing to do is to simply clone this repo (specifically the tessel folder) to your dev machine and then deploy the code to your Tessel device (assuming you have connected up the servo module and USB audio module - check the code for the pin we are using for the servo):

```
t2 run tesselDarknetWs.js
```

Once deployed you should see on your node server the Tessel connected and is sending image data which is being classified. You should see the results of the classification in the terminal. 

Happy hacking! You can [see it in action here](https://www.youtube.com/watch?v=dxsn7W6shKk) where I simply put a piece of cardboard on top of the servo to get it to point at me as I moved around the room! The white thing on the bottom is a big battery ;-)
