const BaseRepository = require('../../shared/base/base.repository');
const Shift = require('./shift.model');

class ShiftRepository extends BaseRepository {
  constructor() {
    super(Shift);
  }

  findByCode(companyId, code) {
    return Shift.findOne({ companyId, code: code.toUpperCase() }, null, { companyId });
  }

  findActive(companyId) {
    return Shift.find({ companyId, status: 'active' }, null, { companyId }).sort({ name: 1 });
  }
}

module.exports = new ShiftRepository();
