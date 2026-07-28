const mongoose = require('mongoose');

const migrationStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    completedAt: { type: Date, default: Date.now },
  },
  { collection: 'migration_state' }
);

const MigrationState =
  mongoose.models.MigrationState || mongoose.model('MigrationState', migrationStateSchema);

const hasMigrationRun = async (key) => {
  const doc = await MigrationState.findOne({ key }).select('_id');
  return Boolean(doc);
};

const markMigrationRun = async (key) => {
  await MigrationState.updateOne({ key }, { $set: { completedAt: new Date() } }, { upsert: true });
};

module.exports = { MigrationState, hasMigrationRun, markMigrationRun };
