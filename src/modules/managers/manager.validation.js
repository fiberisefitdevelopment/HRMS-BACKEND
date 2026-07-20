const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const assignManagerSchema = z.object({
  employeeProfileId: objectId,
  managerId: objectId,
});

const managerIdParamSchema = z.object({ managerId: objectId });

module.exports = { assignManagerSchema, managerIdParamSchema };
