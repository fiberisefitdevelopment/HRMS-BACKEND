const BaseRepository = require('../../shared/base/base.repository');
const Rule = require('./rule.model');

class RuleRepository extends BaseRepository {
  constructor() {
    super(Rule);
  }
}

module.exports = new RuleRepository();
