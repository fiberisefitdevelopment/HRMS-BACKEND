const ApiError = require('../../utils/ApiError');

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async getById(id, options = {}) {
    const doc = await this.repository.findById(id, null, options);
    if (!doc) {
      throw ApiError.notFound('Resource not found');
    }
    return doc;
  }

  async list(filter, query, options = {}) {
    return this.repository.findMany(filter, query, options);
  }

  async create(data, options = {}) {
    return this.repository.create(data, options);
  }

  async update(id, data, options = {}) {
    const doc = await this.repository.updateById(id, data, options);
    if (!doc) {
      throw ApiError.notFound('Resource not found');
    }
    return doc;
  }

  async remove(id, options = {}) {
    const doc = await this.repository.deleteById(id, options);
    if (!doc) {
      throw ApiError.notFound('Resource not found');
    }
    return doc;
  }
}

module.exports = BaseService;
