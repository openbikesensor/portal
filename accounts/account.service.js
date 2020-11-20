const crypto = require('crypto');
const mongoose = require('mongoose');
const sendEmail = require('../_helpers/send-email');
const User = mongoose.model('User');

module.exports = {
  register,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
};

async function register(params, origin) {
  const user = await User.findOne({ email: params.email });

  if (user) {
    // send already registered error in email to prevent account enumeration
    return await sendAlreadyRegisteredEmail(params.email, origin);
  }

  const newUser = new User();

  newUser.username = params.username;
  newUser.email = params.email;
  newUser.setPassword(params.password);
  newUser.verificationToken = randomTokenString();
  newUser.needsEmailValidation = true;

  await newUser.save();

  // send email
  await sendVerificationEmail(newUser, origin);
}

async function verifyEmail({ token }) {
  const account = await User.findOne({ verificationToken: token });

  if (!account) throw 'Verification failed';

  account.needsEmailValidation = false;
  account.verificationToken = undefined;
  await account.save();
}

async function forgotPassword({ email }, origin) {
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
  await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
  const account = await User.findOne({
    'resetToken.token': token,
    'resetToken.expires': { $gt: Date.now() },
  });

  if (!account) throw 'Invalid token';
}

async function resetPassword({ token, password }) {
  const account = await User.findOne({
    'resetToken.token': token,
    'resetToken.expires': { $gt: Date.now() },
  });

  if (!account) throw 'Invalid token';

  // update password and remove reset token
  account.setPassword(password);
  account.resetToken = undefined;
  await account.save();
}

function randomTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

async function sendVerificationEmail(account, origin) {
  let message;
  if (origin) {
    const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
    message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: 'Sign-up Verification API - Verify Email',
    html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`,
  });
}

async function sendAlreadyRegisteredEmail(email, origin) {
  let message;
  if (origin) {
    message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
  } else {
    message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
  }

  await sendEmail({
    to: email,
    subject: 'Sign-up Verification API - Email Already Registered',
    html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`,
  });
}

async function sendPasswordResetEmail(account, origin) {
  let message;
  if (origin) {
    const resetUrl = `${origin}/account/reset-password?token=${account.resetToken.token}`;
    message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken.token}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: 'Sign-up Verification API - Reset Password',
    html: `<h4>Reset Password Email</h4>
               ${message}`,
  });
}
