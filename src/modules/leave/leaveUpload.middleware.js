/**
 * Optional prescription file on leave apply (multipart).
 * Field name: prescription
 * After upload, attaches URL into body.attachments + body.prescription
 */
const parseLeaveApplyUpload = (req, _res, next) => {
  if (req.file) {
    const url = `/uploads/leave/${req.file.filename}`;
    req.body.prescription = url;

    let attachments = req.body.attachments;
    if (typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch {
        attachments = [attachments];
      }
    }
    if (!Array.isArray(attachments)) attachments = [];
    req.body.attachments = [...attachments, url];
  }

  if (typeof req.body.isHalfDay === 'string') {
    req.body.isHalfDay = req.body.isHalfDay === 'true';
  }
  if (typeof req.body.totalDays === 'string' && req.body.totalDays !== '') {
    req.body.totalDays = Number(req.body.totalDays);
  }

  next();
};

module.exports = { parseLeaveApplyUpload };
