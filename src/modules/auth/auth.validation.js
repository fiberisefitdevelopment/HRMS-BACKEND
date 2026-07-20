const { z } = require('zod');
const { PASSWORD_REQUIREMENTS } = require('../../helpers/passwordValidation');

const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

const passwordSchema = z
  .string()
  .min(8, PASSWORD_REQUIREMENTS)
  .regex(/[A-Z]/, PASSWORD_REQUIREMENTS)
  .regex(/[a-z]/, PASSWORD_REQUIREMENTS)
  .regex(/\d/, PASSWORD_REQUIREMENTS)
  .regex(/[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/, PASSWORD_REQUIREMENTS);

const loginSchema = z.object({
  email: z.string().min(1, 'Email or employee code is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

const switchCompanySchema = z.object({
  companyId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid company ID'),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  switchCompanySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
