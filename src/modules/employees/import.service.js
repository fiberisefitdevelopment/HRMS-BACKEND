const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const User = require('../users/user.model');
const EmployeeProfile = require('./employeeProfile.model');
const departmentService = require('../departments/department.service');
const designationService = require('../designations/designation.service');
const employeeService = require('./employee.service');
const { IMPORT_COLUMNS, REQUIRED_IMPORT_COLUMNS } = require('./employee.constants');

const readSpreadsheet = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    return records;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw ApiError.badRequest('Excel file has no worksheets');

  const headers = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value || '').trim();
  });

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    row.eachCell((cell, col) => {
      if (headers[col]) record[headers[col]] = cell.value != null ? String(cell.value).trim() : '';
    });
    if (Object.values(record).some((v) => v)) rows.push(record);
  });

  return rows;
};

const validateTemplate = (rows) => {
  if (!rows.length) throw ApiError.badRequest('File contains no data rows');

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_IMPORT_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length) {
    throw ApiError.badRequest(`Missing required columns: ${missing.join(', ')}`);
  }
};

const validateRow = async (row, rowNumber, companyId, emailSet, employeeIdSet) => {
  const errors = [];

  for (const col of REQUIRED_IMPORT_COLUMNS) {
    if (!row[col]?.trim()) errors.push(`${col} is required`);
  }

  if (row.officialEmail) {
    const email = row.officialEmail.toLowerCase();
    if (emailSet.has(email)) errors.push('Duplicate email in file');
    else emailSet.add(email);

    const exists = await User.findOne({ email });
    if (exists) errors.push('Email already exists in system');
  }

  if (row.joiningDate && isNaN(Date.parse(row.joiningDate))) {
    errors.push('Invalid joining date');
  }

  if (row.managerEmail) {
    const manager = await User.findOne({ email: row.managerEmail.toLowerCase(), companyId });
    if (!manager) errors.push('Manager email not found');
  }

  return {
    rowNumber,
    status: errors.length ? 'failed' : 'valid',
    reason: errors.join('; ') || null,
    data: row,
  };
};

const processImport = async (filePath, companyId, actorId, req, { dryRun = false } = {}) => {
  const rows = await readSpreadsheet(filePath);
  validateTemplate(rows);

  const emailSet = new Set();
  const report = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const validation = await validateRow(rows[i], rowNumber, companyId, emailSet, new Set());

    if (validation.status === 'failed') {
      failed++;
      report.push({ rowNumber, status: 'failed', reason: validation.reason, imported: false });
      continue;
    }

    if (dryRun) {
      report.push({ rowNumber, status: 'valid', reason: 'Dry run — not imported', imported: false });
      continue;
    }

    try {
      const department = await departmentService.findOrCreateByName(rows[i].department, companyId);
      const designation = await designationService.findOrCreateByName(rows[i].designation, companyId);

      let managerId;
      if (rows[i].managerEmail) {
        const manager = await User.findOne({ email: rows[i].managerEmail.toLowerCase(), companyId });
        managerId = manager?._id;
      }

      await employeeService.createEmployee(
        {
          firstName: rows[i].firstName,
          lastName: rows[i].lastName || '',
          officialEmail: rows[i].officialEmail,
          phone: rows[i].phone,
          joiningDate: new Date(rows[i].joiningDate),
          employmentType: rows[i].employmentType || 'full_time',
          workLocation: rows[i].workLocation,
          gender: rows[i].gender,
          dateOfBirth: rows[i].dateOfBirth ? new Date(rows[i].dateOfBirth) : undefined,
          personalEmail: rows[i].personalEmail,
          departmentId: department._id,
          designationId: designation._id,
          managerId,
          roleSlug: rows[i].roleSlug || 'employee',
        },
        companyId,
        actorId,
        req
      );

      imported++;
      report.push({ rowNumber, status: 'imported', reason: null, imported: true });
    } catch (error) {
      failed++;
      report.push({ rowNumber, status: 'failed', reason: error.message, imported: false });
    }
  }

  if (!dryRun && imported > 0) {
    await createAuditLog({
      companyId,
      userId: actorId,
      action: 'import',
      entityType: 'employee',
      metadata: { imported, failed, skipped, total: rows.length },
      req,
    });
  }

  return {
    summary: { total: rows.length, imported, skipped, failed, dryRun },
    report,
    columns: IMPORT_COLUMNS,
  };
};

module.exports = { processImport, readSpreadsheet, validateTemplate };
