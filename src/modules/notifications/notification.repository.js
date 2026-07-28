const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./notification.model');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new NotificationRepository();
