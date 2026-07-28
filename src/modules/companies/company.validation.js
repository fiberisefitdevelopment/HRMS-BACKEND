const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
});

const createCompanySchema = z.object({
  companyName: z.string().min(2).max(200),
  companyCode: z.string().min(2).max(20).toUpperCase(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: addressSchema.optional(),
  logo: z.string().optional(),
});

const updateCompanySchema = createCompanySchema.partial();

const companyIdParamSchema = z.object({ id: objectId });

module.exports = {
  createCompanySchema,
  updateCompanySchema,
  companyIdParamSchema,
};
