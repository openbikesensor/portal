const nodemailer = require('nodemailer');
const config = require('../config');

module.exports = sendEmail;

async function sendEmail({ to, subject, html }) {
  if (config.mail) {
    const from = config.mail.from;

    const transporter = nodemailer.createTransport({
      host: config.mail.smtp.host,
      port: config.mail.smtp.port,
      secure: !config.mail.smtp.starttls,
      requiretls: config.mail.smtp.starttls,
      auth: {
        user: config.mail.smtp.username,
        pass: config.mail.smtp.password,
      },
    });

    await transporter.sendMail({ from, to, subject, html });
  } else {
    console.log(`========== E-Mail disabled, see contents below =========
To: ${to}
Subject: ${subject}

${html}
`)
  }
}
