Requires:
- Apache Server
- MySQL Database
- node.js 16


##LINUX INSTRUCTIONS (tried on ubuntu 18)##

Step 1:
- Set up MySQL database
- Set up Apache server
- (Optional) setup a reverse proxy to assign a domain name to the API.
- Copy config.js-sample to config.js and enter desired details into config.js

Step 2: 
- Open terminal
- Install required software by running `sudo apt install npm nvm`
- Run `git clone https://github.com/realrouse/tokendata.git`
- Run `cd tokendata`
- Run `npm install`
- Run `nvm use 16`
- Run `node server.js` and the server will start

Step 3:
Open up your web browser and access the API at `localhost:3000/api/burns` or something else if you altered APIURL in config


