const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./document.model');

class DocumentRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new DocumentRepository();
