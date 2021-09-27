const crypto = require('crypto');
const sendEmail = require('../_helpers/send-email');
const config = require('../config');
const { User } = require('../models');

const baseUrl = config.baseUrl.replace(/\/+$/, '');

module.exports = {
  register,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
};

async function register(params) {
  const user = await User.findOne({ email: params.email });

  if (user) {
    // send already registered error in email to prevent account enumeration
    return await sendAlreadyRegisteredEmail(params.email);
  }

  const newUser = new User();

  newUser.username = params.username;
  newUser.email = params.email;
  newUser.setPassword(params.password);
  newUser.verificationToken = randomTokenString();
  newUser.needsEmailValidation = true;

  await newUser.save();

  // send email
  await sendVerificationEmail(newUser);
}

async function verifyEmail({ token }) {
  const account = await User.findOne({ verificationToken: token });

  if (!account) {
    throw Error('Verification failed');
  }

  account.needsEmailValidation = false;
  account.verificationToken = undefined;
  await account.save();
}

async function forgotPassword({ email }) {
  const account = await User.findOne({ email });

  console.log('forgotPassword', account, email);

  // always return ok response to prevent email enumeration
  if (!account) return;

  // create reset token that expires after 24 hours
  account.resetToken = {
    token: randomTokenString(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
  await account.save();

  console.log('forgotPassword account saved', account);

  // send email
  await sendPasswordResetEmail(account);
}

async function validateResetToken({ token }) {
  const account = await User.findOne({
    'resetToken.token': token,
    'resetToken.expires': { $gt: Date.now() },
  });

  if (!account) {
    throw Error('Invalid token');
  }
}

async function resetPassword({ token, password }) {
  const account = await User.findOne({
    'resetToken.token': token,
    'resetToken.expires': { $gt: Date.now() },
  });

  if (!account) {
    throw Error('Invalid token');
  }

  // update password and remove reset token
  account.setPassword(password);
  account.resetToken = undefined;

  // Since password recovery happens through email, we can consider this a
  // successful verification of the email address.
  account.needsEmailValidation = false;
  account.verificationToken = undefined;

  await account.save();
}

function randomTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

async function sendVerificationEmail(account) {
  const verifyUrl = `${baseUrl}/verify-email?token=${account.verificationToken}`;
  const html = [
    '<h4>Verify Email</h4>',
    '<p>Thanks for registering!</p>',
    '<p>Please click the below link to verify your email address:</p>',
    `<p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  ].join('\n');

  await sendEmail({
    to: account.email,
    subject: 'Sign-up Verification API - Verify Email',
    html,
  });
}

async function sendAlreadyRegisteredEmail(email) {
  const message = `<p>If you don't know your password please visit the <a href="${baseUrl}/forgot-password">forgot password</a> page.</p>`;

  await sendEmail({
    to: email,
    subject: 'Sign-up Verification API - Email Already Registered',
    html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`,
  });
}

async function sendPasswordResetEmail(account) {
  const resetUrl = `${baseUrl}/reset-password?token=${account.resetToken.token}`;
  const message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                 <p><a href="${resetUrl}">${resetUrl}</a></p>`;
  await sendEmail({
    to: account.email,
    subject: 'Sign-up Verification API - Reset Password',
    html: `<h4>Reset Password Email</h4>
               ${message}`,
  });
}
