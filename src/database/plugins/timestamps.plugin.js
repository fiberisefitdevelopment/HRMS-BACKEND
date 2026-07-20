const timestampsPlugin = (schema) => {
  schema.add({
    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  });

  schema.pre('save', function updateTimestamp(next) {
    this.updatedAt = new Date();
    next();
  });

  schema.pre('findOneAndUpdate', function updateTimestamp() {
    this.set({ updatedAt: new Date() });
  });
};

module.exports = timestampsPlugin;
