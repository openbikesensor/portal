# OpenBikeSensor Web API
The backend API for the [OpenBikeSensor](https://zweirat-stuttgart.de/projekte/openbikesensor/) Web App.

## Running it
### Requirements
A working installation of npm and node.js - get the latest node.js LTS release at [the node.js homepage](https://nodejs.org/en/) and verify it's working via `node -v` and `npm -v` in a command prompt of your choice.

A working installation of [Docker](https://www.docker.com) for the used containerized MongoDB. 

### First start
To get started you need to download all used packages with `npm i` in the project's root folder first.

Next up is our local MongoDB. This uses docker but can be conveniently started via `sudo npm run mongo:start` (at least in Ubuntu Linux).

Afterwards the dev server is started with `npm run dev` and can be called via `http://localhost:3000/api`.

To completely stop the project after running it a call to `sudo npm run mongo:stop` is necessary.

### Running the tests
Just execute `npm run test` while both the node.js server and the MongoDB are up and running.

Warning: At the moment (2020-09-29) there are no tests.

### Uploading a track for test purposes
Uploading a track to the local server requires multiple steps, as uploading is not possible via the dummy upload form in the corresponding web app yet:
- Create a user in the web app and copy the user id, which can be found at (http://localhost:4200/settings) as "API key"
- Import the [Postman](https://www.postman.com) script "add-track.json" from the "postman-examples" into Postman
- In each of the three requests add your user id in the "Pre-request script" tab as the value for the "UserId" variable
- As tracks have to be split into smaller parts to get a working upload from the sensor you have to run the three requests in the order of: begin -> add -> end
- View your freshly uploaded track at (http://localhost:4200) -> Home -> Your feed

### Sending E-Mails
By default in development mode mails are not sent, but instead the mail data is logged to the console. This can be overriden with the `--devSendMails` flag if you start the application like so: `npm run dev -- --devSendMails`.

Mails are also always sent in production mode!

For actually sending e-mails the mailserver, sender, user and password for the SMTP server need to be specified as environment variables. The username is read from `MAILUSER`, and the password is read from `MAILPW`, Mailserver is read from 'MAILSERVER' and the sender name from 'MAILSENDER', so in local development startup would like something like this (at least in Linux): `MAILSERVER=mail.my-domain.de MAILSENDER=noreply@whatever.de MAILUSER=myuser MAILPW=supersecurepassword npm run dev -- --devSendMails`.
