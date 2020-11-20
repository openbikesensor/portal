const isProduction = process.env.NODE_ENV === 'production';
const forcedMail = process.argv.findIndex((s) => s === '--devSendMails') !== -1;

module.exports = {
  sendMails: isProduction || forcedMail,
  emailFrom: process.env.MAILSENDER,
  smtpOptions: {
    host: process.env.MAILSERVER,
    port: 587,
    auth: {
      user: process.env.MAILUSER,
      pass: process.env.MAILPW,
    },
  },
};
