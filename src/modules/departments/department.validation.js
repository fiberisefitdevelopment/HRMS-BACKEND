const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const createDepartmentSchema = z.object({
  name: z.string().min(2).max(150),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().max(500).optional(),
  parentDepartmentId: objectId.optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

const departmentIdParamSchema = z.object({ id: objectId });

module.exports = { createDepartmentSchema, updateDepartmentSchema, departmentIdParamSchema };
