const express = require('express');
const router = express.Router();
const Joi = require('joi');
const wrapRoute = require('../_helpers/wrapRoute');
const validateRequest = require('../_middleware/validate-request');
const accountService = require('./account.service');

router.post(
  '/register',
  validateRequest(
    Joi.object({
      username: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    }),
  ),
  wrapRoute(async (req, res) => {
    await accountService.register(req.body, req.get('origin'));
    res.json({ message: 'Registration successful, please check your email for verification instructions' });
  }),
);

router.post(
  '/verify-email',
  validateRequest(
    Joi.object({
      token: Joi.string().required(),
    }),
  ),
  wrapRoute(async (req, res) => {
    await accountService.verifyEmail(req.body);
    res.json({ message: 'Verification successful, you can now login' });
  }),
);

router.post(
  '/forgot-password',
  validateRequest(
    Joi.object({
      email: Joi.string().email().required(),
    }),
  ),
  wrapRoute(async (req, res) => {
    await accountService.forgotPassword(req.body, req.get('origin'));
    res.json({ message: 'Please check your email for password reset instructions' });
  }),
);

router.post(
  '/validate-reset-token',
  validateRequest(
    Joi.object({
      token: Joi.string().required(),
    }),
  ),
  wrapRoute(async (req, res) => {
    await accountService.validateResetToken(req.body);
    res.json({ message: 'Token is valid' });
  }),
);

router.post(
  '/reset-password',
  validateRequest(
    Joi.object({
      token: Joi.string().required(),
      password: Joi.string().min(6).required(),
      confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    }),
  ),
  wrapRoute(async (req, res) => {
    await accountService.resetPassword(req.body);
    res.json({ message: 'Password reset successful, you can now login' });
  }),
);

module.exports = router;
