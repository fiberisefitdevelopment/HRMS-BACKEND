const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify/sync');
const reportService = require('./report.service');
const { createAuditLog } = require('../../helpers/audit');

const exportDir = path.join(process.cwd(), 'uploads', 'exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

const exportReport = async (type, companyId, query, actorId, req, format = 'xlsx') => {
  const report = await reportService.generateReport(type, companyId, query);
  const headers = Object.keys(report.data[0] || { type: '', status: '' });
  const rows = report.data;

  const filename = `leave-${type}-${Date.now()}.${format}`;
  const filepath = path.join(exportDir, filename);

  if (format === 'csv') {
    fs.writeFileSync(filepath, stringify(rows, { header: true, columns: headers }));
  } else {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leave');
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(headers.map((h) => row[h] ?? '')));
    await workbook.xlsx.writeFile(filepath);
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'export',
    entityType: 'leave',
    metadata: { type, format, count: rows.length },
    req,
  });

  return { filepath, filename, count: rows.length };
};

module.exports = { exportReport };
