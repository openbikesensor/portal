# OpenBikeSensor Portal

This repository contains the source code required to run the
[OpenBikeSensor](https://openbikesensor.org) data collection portal. It is
separated into components:

* **api**: The backend service, written in JavaScript for Node.js, using
  express.js, and a MongoDB for metadata storage.
* **frontend**: A React single-page application that allows access to the data,
  provides summaries and visualizations, and lets users adjust settings and
  manage and publish their tracks.
  
## Deployment setup

You should be familiar with managing a Linux server. If not, find a suitable
guide first. This will only give a rough outline of the steps to take, you must
make sure to properly set up and secure your server yourself.

1. Create a user for running the application. It is not recommended to run as a
   user that is also used for other things. Do not run as root!
2. Clone the repository.
3. Install `node` of at least version 14, and also `npm`.
4. Run `npm ci` in the `api` and `frontend` directories to install dependencies.
5. Install and configure a MongoDB somewhere.
6. Copy `api/config.json.example` to `api/config.json` and change it to suit
   your setup. Make sure to only use https URLs. Generate secure secrets.
   Customize client IDs.
7. Copy `frontend/src/config.json.example` to `frontend/src/config.json` and
   adjust.
8. Run `npm run build` in the frontend directory. This needs to be done after
   changing the config, so if you did something wrong, re-run the build. If you
   run your frontend on a non-root URL, run the build with the
   `PUBLIC_URL=/prefix` environment variable.
9. Create a systemd-user service, or use tmux, or do whatever you like to start
   the API service (`npm start` in `api/` directory). It should run as the
   dedicated user, and expose `127.0.0.1:3000`. Use `PORT` environment variable
   if you want to change the port. Make sure the service starts with
   environment `NODE_ENV=production`, too.
10. Configure nginx or your reverse-proxy of choice to forward API requests to
    the API port, and serve static files from the `frontend/build/` folder.

## Development setup

We've moved the whole development setup into Docker to make it easy for
everyone to get involved. After sucessfully [installing Docker
Engine](https://docs.docker.com/engine/install/) as well as [Docker
Compose](https://docs.docker.com/compose/install/) onto your machine, and
cloning the repository, all you need to do is:

```bash
docker-compose up -d
```

If this does not work, please open an issue and describe the problem you're
having, as it is important to us that onboarding is super easy :)

Your frontend should be running at http://localhost:3001 and the API at
http://localhost:3000 -- but you probably only need to access the frontend for
testing. The frontend dev server also proxies all unknown requests to the API,
so the frontend always just requests data at its own URL.

## Running without docker

If you don't like docker, or want to run this in production without it, you can
do so as well. Our Docker setup is simply a slight wrapper around very simple
JavaScript packages that you can install yourself as usual, with `npm install`.
The API can be started with `npm start` inside its folder. The frontend
development server uses `npm start` as well, while building a production
version of the frontend happens with `npm run build`.

To connect the parts together, please have a look at what we're doing in the
"official" setup of docker, i.e. in `docker-compose.yaml`, the `Dockerfile`s
and in the respective `package.json` of the service. If you've done this kind
of thing before, it's not that hard. Otherwise, ask on Slack and there will be
somebody to help you ;)

## Running in production

You are advised not to use the dockerized mongodb service and instead do a
proper MongoDB setup on a server that is backed up and secured.

You can run the API in docker, but it is prefered to run it as a restricted
user in its own directory somewhere where it cannot escape ;)

The frontend should be built using `npm run build` and then served from a
proper web server, such as nginx or apache. See the instructions at
create-react-app concerning [deployment of an app](http://cra.link/deployment).

You are advised to virtualize your server for security reason, and separate
this whole application from other parts of your server system.

Also please install a reverse proxy that terminates TLS for you and handles
certificates. We do not support TLS directly in the application, instead,
please use this prefered method. This reverse proxy can also handle static file
serving for the frontend, no need for two separate server processes.

## Migrating

Sometimes your database will have to be migrated. The docker setup should do
this automatically, but if it does not work, you can run the following
commands:

```bash
# if running locally
(cd api/; npm run migrate:up)

# if running in docker
docker-compose run --rm api npm run migrate:up
````

## Custom MongoDB installation
    
If you have your own MongoDB instance running somewhere, you can set the
environment variable `MONGODB_URL` when starting the server, and it will read
that URL for connecting.
  
    export MONGODB_URL=mongodb://user:password@mongodb.example.com/obs-app-database
    
This does not work when using docker-compose, in that case, you will have to
modify the `docker-compose.yaml` to include that URL.


## E-Mail Setup

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

All of this of course is not too important if you're developing locally. To get
to the logged email content that *would* have been sent, check your docker log:

```bash
docker-compose log -f api
```
