const Company = require('../../modules/companies/company.model');
const Holiday = require('../../modules/holidays/holiday.model');
const CompanyLeavePolicy = require('../../modules/leave-policies/companyLeavePolicy.model');
const { dbLogger } = require('../../config/logger');

/** 2026 company holiday calendar (shared across Fiberise / Vytalix). */
const HOLIDAYS_2026 = [
  { holidayName: 'New Year', holidayDate: '2026-01-01', description: 'Public Holiday', holidayCode: '300' },
  { holidayName: 'Republic Day', holidayDate: '2026-01-26', description: 'Public Holiday', holidayCode: '301' },
  { holidayName: 'Holi', holidayDate: '2026-03-04', description: 'Festival', holidayCode: '302' },
  { holidayName: 'Eid-ul-Fitr', holidayDate: '2026-03-21', description: 'Tentative', holidayCode: '303' },
  { holidayName: 'Eid-ul-Zuha', holidayDate: '2026-05-27', description: 'Tentative', holidayCode: '304' },
  { holidayName: 'Independence Day', holidayDate: '2026-08-15', description: 'National Holiday', holidayCode: '305' },
  { holidayName: 'Raksha Bandhan', holidayDate: '2026-08-28', description: 'Festival', holidayCode: '306' },
  { holidayName: 'Janmashtami', holidayDate: '2026-09-04', description: 'Festival', holidayCode: '307' },
  { holidayName: 'Gandhi Jayanti', holidayDate: '2026-10-02', description: 'National Holiday', holidayCode: '308' },
  { holidayName: 'Deepawali', holidayDate: '2026-11-08', description: 'Festival', holidayCode: '309' },
  { holidayName: 'Bhai Duj', holidayDate: '2026-11-11', description: 'Festival', holidayCode: '310' },
  { holidayName: "Guru Nanak's Birthday", holidayDate: '2026-11-24', description: 'Festival', holidayCode: '311' },
  { holidayName: 'Christmas Day', holidayDate: '2026-12-25', description: 'Public Holiday', holidayCode: '312' },
];

const toDateOnly = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const seedHolidays = async () => {
  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });
  if (!companies.length) {
    dbLogger.warn('No companies found — skipping holiday seed');
    return;
  }

  let inserted = 0;

  for (const company of companies) {
    for (const h of HOLIDAYS_2026) {
      const holidayDate = toDateOnly(h.holidayDate);
      const result = await Holiday.updateOne(
        {
          companyId: company._id,
          holidayName: h.holidayName,
          holidayDate,
        },
        {
          $set: {
            companyId: company._id,
            holidayName: h.holidayName,
            holidayDate,
            description: h.description,
            holidayCode: h.holidayCode,
            location: '',
            isActive: true,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      if (result.upsertedCount) inserted += 1;
    }

    // Keep leave-policy holidays in sync for calendar / leave validation
    const policyHolidays = HOLIDAYS_2026.map((h) => ({
      date: toDateOnly(h.holidayDate),
      name: h.holidayName,
    }));
    await CompanyLeavePolicy.updateOne(
      { companyId: company._id },
      { $set: { holidays: policyHolidays } }
    );
  }

  dbLogger.info(
    inserted > 0
      ? `Seeded ${inserted} holiday record(s) across ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`
      : `Holidays already present — synced leave-policy holiday dates for ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`
  );
};

module.exports = { seedHolidays, HOLIDAYS_2026 };
