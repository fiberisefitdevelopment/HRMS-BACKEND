const roleRepository = require('./role.repository');

const getAllRoles = async () => {
  const roles = await roleRepository.findAllActive();
  return roles.map((role) => ({
    id: role._id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    hierarchy: role.hierarchy,
    isSystem: role.isSystem,
    permissions: role.permissions?.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      module: p.module,
      action: p.action,
    })),
  }));
};

module.exports = { getAllRoles };
