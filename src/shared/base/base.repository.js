const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data, options = {}) {
    const doc = await this.model.create([data], options);
    return doc[0];
  }

  async findById(id, projection = null, options = {}) {
    return this.model.findById(id, projection, options);
  }

  async findOne(filter, projection = null, options = {}) {
    return this.model.findOne(filter, projection, options);
  }

  async findMany(filter = {}, query = {}, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort);

    const queryOptions = { ...options };
    if (options.companyId) {
      queryOptions.companyId = options.companyId;
    }

    const [data, total] = await Promise.all([
      this.model.find(filter, null, queryOptions).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(filter, queryOptions),
    ]);

    return {
      data,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async updateById(id, data, options = {}) {
    return this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true, ...options });
  }

  async deleteById(id, options = {}) {
    return this.model.findByIdAndDelete(id, options);
  }

  async exists(filter, options = {}) {
    const count = await this.model.countDocuments(filter, { limit: 1, ...options });
    return count > 0;
  }
}

module.exports = BaseRepository;
