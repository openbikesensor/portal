const nodemailer = require('nodemailer');
const config = require('../config/email');

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.emailFrom }) {
  if (config.sendMails) {
    const transporter = nodemailer.createTransport(config.smtpOptions);
    await transporter.sendMail({ from, to, subject, html });
  } else {
    console.log({
      to, subject, html, from
    });
  }
}