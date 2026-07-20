const { z } = require('zod');

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  unreadOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

const notificationIdParam = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

module.exports = {
  listQuerySchema,
  notificationIdParam,
};
