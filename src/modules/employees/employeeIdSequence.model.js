const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS } = require('../../constants');

const employeeIdSequenceSchema = new mongoose.Schema(
  {
    sequenceKey: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    prefix: { type: String, required: true, uppercase: true },
    lastNumber: { type: Number, default: 0 },
  },
  { collection: COLLECTIONS.EMPLOYEE_ID_SEQUENCES }
);

employeeIdSequenceSchema.plugin(timestampsPlugin);

module.exports = mongoose.model('EmployeeIdSequence', employeeIdSequenceSchema);
