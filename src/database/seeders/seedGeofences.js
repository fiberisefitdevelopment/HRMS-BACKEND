const Company = require('../../modules/companies/company.model');
const OfficeGeofence = require('../../modules/geofences/officeGeofence.model');
const CompanyAttendancePolicy = require('../../modules/attendance-policies/companyAttendancePolicy.model');
const { dbLogger } = require('../../config/logger');

/** Shared HQ coordinates — both demo companies configure their own fence at the same site. */
const SHARED_OFFICE = {
  name: 'Shared HQ',
  latitude: 19.1136,
  longitude: 72.8697,
  radiusMeters: 200,
  address: 'Shared Office Campus, Mumbai',
};

const seedGeofences = async () => {
  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });
  if (!companies.length) {
    dbLogger.info('No demo companies found — skipping geofence seed');
    return;
  }

  for (const company of companies) {
    const existing = await OfficeGeofence.countDocuments({ companyId: company._id }, { companyId: company._id });
    if (existing === 0) {
      await OfficeGeofence.create({
        ...SHARED_OFFICE,
        companyId: company._id,
        isActive: true,
      });
      dbLogger.info(`Seeded office geofence for ${company.companyName}`);
    }

    await CompanyAttendancePolicy.updateOne(
      { companyId: company._id, isDefault: true },
      {
        $set: {
          'geofencing.enabled': false,
          'geofencing.enforceOnPunchIn': true,
          'geofencing.enforceOnPunchOut': true,
          'geofencing.applyToAllEmployees': true,
          'geofencing.employeeProfileIds': [],
        },
      },
      { companyId: company._id }
    );
  }
};

module.exports = { seedGeofences };
