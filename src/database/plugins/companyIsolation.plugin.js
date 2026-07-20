const companyIsolationPlugin = (schema) => {
  schema.pre(/^find/, function enforceCompanyScope() {
    const companyId = this.getOptions().companyId;
    if (companyId) {
      this.where({ companyId });
    }
  });

  schema.pre('aggregate', function enforceCompanyScopeAggregate() {
    const companyId = this.options?.companyId;
    if (companyId) {
      this.pipeline().unshift({ $match: { companyId } });
    }
  });
};

module.exports = companyIsolationPlugin;
