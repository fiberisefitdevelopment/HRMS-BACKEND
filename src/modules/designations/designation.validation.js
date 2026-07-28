const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const createDesignationSchema = z.object({
  name: z.string().min(2).max(150),
  code: z.string().min(2).max(20).toUpperCase(),
  level: z.number().int().min(1).optional(),
  description: z.string().max(500).optional(),
});

const updateDesignationSchema = createDesignationSchema.partial();

const designationIdParamSchema = z.object({ id: objectId });

module.exports = { createDesignationSchema, updateDesignationSchema, designationIdParamSchema };
