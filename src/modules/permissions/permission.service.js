const permissionRepository = require('./permission.repository');

const getAllPermissions = async () => {
  const permissions = await permissionRepository.findAll();
  return permissions.map((p) => ({
    id: p._id,
    name: p.name,
    slug: p.slug,
    module: p.module,
    action: p.action,
    description: p.description,
  }));
};

module.exports = { getAllPermissions };
