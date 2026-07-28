const { z } = require('zod');
const { EMPLOYMENT_TYPES } = require('../../constants');
const { PASSWORD_REQUIREMENTS } = require('../../helpers/passwordValidation');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');
const phoneRegex = /^[+]?[\d\s-]{10,15}$/;

const profileFields = {
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  managerId: objectId.optional(),
  shiftId: objectId.optional().nullable(),
  joiningDate: z.coerce.date(),
  confirmationDate: z.coerce.date().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  workLocation: z.string().optional(),
  officeLocation: z.string().optional(),
  bloodGroup: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.coerce.date().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  nationality: z.string().optional(),
  personalEmail: z.string().email().optional(),
  officialEmail: z.string().email(),
  phone: z.string().regex(phoneRegex, 'Invalid phone number').optional(),
  alternatePhone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactNumber: z.string().optional(),
  relation: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  panNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  uan: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
};

const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  roleSlug: z.enum(['employee', 'manager', 'hr']).default('employee'),
  password: z.string().min(8, PASSWORD_REQUIREMENTS).optional(),
  ...profileFields,
});

const updateEmployeeSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().max(100).optional(),
    departmentId: objectId.optional(),
    designationId: objectId.optional(),
    managerId: objectId.optional(),
    shiftId: objectId.optional().nullable(),
    joiningDate: z.coerce.date().optional(),
    confirmationDate: z.coerce.date().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    workLocation: z.string().optional(),
    officeLocation: z.string().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: z.coerce.date().optional(),
    maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
    nationality: z.string().optional(),
    personalEmail: z.string().email().optional(),
    officialEmail: z.string().email().optional(),
    phone: z.string().optional(),
    alternatePhone: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactNumber: z.string().optional(),
    relation: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    bloodGroup: z.string().optional(),
    bankName: z.string().optional(),
    ifscCode: z.string().optional(),
    uan: z.string().optional(),
    pfNumber: z.string().optional(),
    esiNumber: z.string().optional(),
  })
  .strict();

const employeeIdParamSchema = z.object({ id: objectId });

const bulkIdsSchema = z.object({
  employeeIds: z.array(objectId).min(1),
});

const bulkDepartmentSchema = bulkIdsSchema.extend({
  departmentId: objectId,
});

const bulkDesignationSchema = bulkIdsSchema.extend({
  designationId: objectId,
});

const bulkManagerSchema = bulkIdsSchema.extend({
  managerId: objectId.nullable(),
});

const searchQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  managerId: objectId.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  employmentCategory: z.enum(['permanent', 'contractual']).optional(),
  status: z.string().optional(),
  joiningDateFrom: z.string().optional(),
  joiningDateTo: z.string().optional(),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  bulkIdsSchema,
  bulkDepartmentSchema,
  bulkDesignationSchema,
  bulkManagerSchema,
  searchQuerySchema,
};
