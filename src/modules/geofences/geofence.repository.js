const BaseRepository = require('../../shared/base/base.repository');
const OfficeGeofence = require('./officeGeofence.model');

class GeofenceRepository extends BaseRepository {
  constructor() {
    super(OfficeGeofence);
  }

  findActive(companyId) {
    return OfficeGeofence.find({ companyId, isActive: true }, null, { companyId }).sort({ name: 1 });
  }
}

module.exports = new GeofenceRepository();
