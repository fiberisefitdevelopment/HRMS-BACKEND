const { PAGINATION } = require('../constants');

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT, 1),
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const parseSort = (sortQuery, defaultSort = { createdAt: -1 }) => {
  if (!sortQuery) return defaultSort;

  const sort = {};
  const fields = sortQuery.split(',');

  fields.forEach((field) => {
    const trimmed = field.trim();
    if (trimmed.startsWith('-')) {
      sort[trimmed.slice(1)] = -1;
    } else {
      sort[trimmed] = 1;
    }
  });

  return Object.keys(sort).length > 0 ? sort : defaultSort;
};

const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = {
  parsePagination,
  parseSort,
  buildPaginationMeta,
};
