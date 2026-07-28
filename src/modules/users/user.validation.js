const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user ID');

const blockUserSchema = z.object({
  userId: objectIdSchema,
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

const unblockUserSchema = z.object({
  userId: objectIdSchema,
});

module.exports = {
  blockUserSchema,
  unblockUserSchema,
};
