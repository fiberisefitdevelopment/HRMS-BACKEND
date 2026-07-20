const Permission = require('../../modules/permissions/permission.model');
const Role = require('../../modules/roles/role.model');
const { DEFAULT_PERMISSIONS, ROLE_DEFINITIONS } = require('../../modules/auth/auth.constants');
const { dbLogger } = require('../../config/logger');

const syncPermissions = async () => {
  const existing = await Permission.find().select('slug');
  const existingSlugs = new Set(existing.map((p) => p.slug));

  const toInsert = DEFAULT_PERMISSIONS.filter((p) => !existingSlugs.has(p.slug));
  if (toInsert.length > 0) {
    await Permission.insertMany(toInsert.map((p) => ({ ...p, isSystem: true, description: p.name })));
    dbLogger.info(`Synced ${toInsert.length} new permissions`);
  }

  const allPermissions = await Permission.find();
  for (const roleDef of ROLE_DEFINITIONS) {
    const rolePermissions = allPermissions
      .filter((p) => roleDef.permissionFilter(p.slug))
      .map((p) => p._id);

    await Role.updateOne(
      { slug: roleDef.slug, isSystem: true },
      { $set: { permissions: rolePermissions } }
    );
  }
};

module.exports = { syncPermissions };
