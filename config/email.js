const isProduction = process.env.NODE_ENV === 'production';
const forcedMail = process.argv.findIndex(s => s === '--devSendMails') !== -1;

module.exports = {
  "sendMails": isProduction || forcedMail,
  "emailFrom": "noreply@openbikesensor.org",
  "smtpOptions": {
    "host": "mail.your-server.de",
    "port": 587,
    "auth": {
      "user": process.env.MAILUSER,
      "pass": process.env.MAILPW
    }
  }
};