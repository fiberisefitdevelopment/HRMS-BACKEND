const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const createGeofenceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().min(10).max(50000).optional().default(150),
  address: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

const updateGeofenceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().min(10).max(50000).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const geofenceIdParamSchema = z.object({
  id: objectId,
});

const validateLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

module.exports = {
  createGeofenceSchema,
  updateGeofenceSchema,
  geofenceIdParamSchema,
  validateLocationSchema,
};
