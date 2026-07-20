const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const fs = require('fs');
const { createAuditLog } = require('../../helpers/audit');
const reportService = require('./report.service');

const exportDir = path.resolve(process.cwd(), 'uploads/exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

const exportReport = async (type, companyId, query, actorId, req, format = 'xlsx') => {
  const report = await reportService.generateReport(type, companyId, query);

  const headers = [
    'date',
    'employeeId',
    'employeeName',
    'shift',
    'punchIn',
    'punchOut',
    'netWorkingMinutes',
    'lateByMinutes',
    'status',
    'regularized',
  ];

  const rows = report.data.map((r) => ({
    date: r.date?.toISOString?.()?.split('T')[0],
    employeeId: r.employee?.employeeId,
    employeeName: r.user?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim(),
    shift: r.shiftId?.name,
    punchIn: r.punchIn?.timestamp,
    punchOut: r.punchOut?.timestamp,
    netWorkingMinutes: r.netWorkingMinutes,
    lateByMinutes: r.lateByMinutes,
    status: r.attendanceStatus,
    regularized: r.isRegularized,
  }));

  const filename = `attendance-${type}-${Date.now()}.${format}`;
  const filepath = path.join(exportDir, filename);

  if (format === 'csv') {
    fs.writeFileSync(filepath, stringify(rows, { header: true, columns: headers }));
  } else {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(headers.map((h) => row[h] ?? '')));
    await workbook.xlsx.writeFile(filepath);
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'export',
    entityType: 'attendance',
    metadata: { type, format, count: rows.length },
    req,
  });

  return { filepath, filename, count: rows.length };
};

module.exports = { exportReport };
