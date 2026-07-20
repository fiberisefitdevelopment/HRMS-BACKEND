const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS } = require('../../constants');

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Permission name is required'],
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: [true, 'Permission slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    module: {
      type: String,
      required: [true, 'Module is required'],
      trim: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      lowercase: true,
    },
    description: { type: String, trim: true, maxlength: 500 },
    isSystem: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.PERMISSIONS }
);

permissionSchema.plugin(timestampsPlugin);
permissionSchema.index({ slug: 1 }, { unique: true });
permissionSchema.index({ module: 1, action: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
