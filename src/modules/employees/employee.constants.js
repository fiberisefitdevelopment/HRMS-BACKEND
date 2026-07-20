const IMPORT_COLUMNS = [
  'firstName',
  'lastName',
  'officialEmail',
  'phone',
  'department',
  'designation',
  'managerEmail',
  'joiningDate',
  'employmentType',
  'workLocation',
  'gender',
  'dateOfBirth',
  'personalEmail',
  'roleSlug',
];

const REQUIRED_IMPORT_COLUMNS = ['firstName', 'lastName', 'officialEmail', 'joiningDate', 'department', 'designation'];

module.exports = { IMPORT_COLUMNS, REQUIRED_IMPORT_COLUMNS };
