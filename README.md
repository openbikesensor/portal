# OpenBikeSensor Web API

The backend API for the [OpenBikeSensor](https://zweirat-stuttgart.de/projekte/openbikesensor/) Web App.

## Direct setup

### Requirements

* A working installation of npm and node.js - get the latest node.js LTS
  release at [the node.js homepage](https://nodejs.org/en/) and verify it's
  working via `node -v` and `npm -v` in a command prompt of your choice. At
  least node version 10.x is required.
* A working installation of [Docker](https://www.docker.com) for the
  containerized MongoDB. Alternatively, you can set up your own MongoDB
  elsewhere.

### First start

To get started you first need to download all dependencies in the project's
root folder:

    npm install

Next up we have to run a MongoDB instance. The following command uses docker,
it assumes you have the docker daemon installed and running.  Working with
docker might require root privileges, depending on your docker setup, so you
might want to prefix the following command with `sudo`:

    npm run mongo:start

The development server will be accessible at `http://localhost:3000/api` after
starting it like this:

    npm run dev

To stop the database when you're done developing, run (potentially with sudo):

    npm run mongo:stop

## Docker setup 

If you have docker and don't want to bother installing Node.js on your machine,
you can run the application inside docker as well:

    docker-compose up -d
    
This will first build the `obs-api` image, which contains all the steps
outlined above, and then run the services, both a mongodb and the api itself,
in docker containers. Interaction with the processes is different though,
expect other guides or commands to work differently in this type of setup.


## Custom MongoDB installation
    
If you have your own MongoDB instance running somewhere, you can set the
environment variable `MONGODB_URL` when starting the server, and it will read
that URL for connecting.
  
    export MONGODB_URL=mongodb://user:password@mongodb.example.com/obs-app-database
    
This does not work when using docker-compose, in that case, you will have to
modify the `docker-compose.yaml` to include that URL.


## Usage

### Sending E-Mails

By default in development mode mails are not sent, but instead the mail data is
logged to the console. This can be overriden with the `--devSendMails` flag if
you start the application like so: `npm run dev -- --devSendMails`.

Mails are also always sent in production mode!

For actually sending e-mails the mailserver, sender, user and password for the
SMTP server need to be specified as environment variables: 

* `MAILUSER` -- the smtp mailbox login name
* `MAILPW` -- password for the mailbox
* `MAILSERVER` -- the hostname of the SMTP server, e.g. `mail.example.com`
* `MAILSENDER` -- sender name, e.g. `noreply@example.com`

Full command example:

```bash
MAILSERVER=mail.example.com MAILSENDER=noreply@example.com \
    MAILUSER=my_mail_login MAILPW=hunter2 \
    npm run dev -- --devSendMails
```
