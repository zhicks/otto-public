# Otto

You're looking at code for an app called Otto, which controls lights in your home using motion sensors, Phillips Hue light bulbs, and Raspberry Pis.

*Note*: This is a personal project - some values are hard coded to my personal PC and deployment - but still serves as an example of code and architecture. Some extraneous files and variables were removed.

## How It Works
* An online server runs that communicates with Raspberry Pis and a local server at home using sockets. Because the server is online, lights can be controlled from outside the home.
* A Raspberry Pi is loaded with the Otto software and upon starting for the first time, communicates with the online server to establish itself as a "room."
* Upon entering a room with a Pi in it (called `satellites` in the code), a motion detector hooked up the Pi detects you entering and sends a message via socket to the online server.
* The online server tells the home server (called `big-red` in the code) that a Pi with that room ID has detected motion. The home server then sends a message to the local Phillips Hue Hub to turn on that specific light.
* After motion is not detected for some time frame (depending on the data in `db.json`), a message is sent to turn the lights off for that room.
* The online server also hosts an Angular application where you can see status of the lights, change the room they're in, and add or remove rooms.

## Directory Structure
* otto-big-red: All code that runs on the home server
* otto-dash-client: The Angular code that is served by the online server
* otto-dash-server: The online server that sends and receives socket messages as well as hosts the dashboard client
    * Since this is a simple personal project, an actual database isn't used - instead, it's a JSON file read by `db-service.ts`.
* otto-shared: Some constants and interfaces used for better organization.

