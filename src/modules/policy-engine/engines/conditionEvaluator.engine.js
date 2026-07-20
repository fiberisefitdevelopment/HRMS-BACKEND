const { CONDITION_OPERATORS } = require('../../../constants');

const getFieldValue = (context, field) => {
  if (!field || !context) return undefined;
  const parts = field.split('.');
  let value = context;
  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
};

const evaluateSingleCondition = (condition, context) => {
  const fieldValue = getFieldValue(context, condition.field);
  const target = condition.value;

  switch (condition.operator) {
    case 'eq':
      return fieldValue == target;
    case 'ne':
      return fieldValue != target;
    case 'gt':
      return Number(fieldValue) > Number(target);
    case 'gte':
      return Number(fieldValue) >= Number(target);
    case 'lt':
      return Number(fieldValue) < Number(target);
    case 'lte':
      return Number(fieldValue) <= Number(target);
    case 'in':
      return Array.isArray(target) && target.includes(fieldValue);
    case 'between':
      return Array.isArray(target) && Number(fieldValue) >= Number(target[0]) && Number(fieldValue) <= Number(target[1]);
    case 'contains':
      return String(fieldValue || '').includes(String(target));
    case 'starts_with':
      return String(fieldValue || '').startsWith(String(target));
    case 'ends_with':
      return String(fieldValue || '').endsWith(String(target));
    default:
      return false;
  }
};

const evaluateGroup = (group, conditionsByGroup, childGroupsByParent, context) => {
  const conditions = conditionsByGroup.get(group._id.toString()) || [];
  const childGroups = childGroupsByParent.get(group._id.toString()) || [];

  const conditionResults = conditions.map((c) => evaluateSingleCondition(c, context));
  const childResults = childGroups.map((cg) => evaluateGroup(cg, conditionsByGroup, childGroupsByParent, context));

  const allResults = [...conditionResults, ...childResults];

  if (group.logicalOperator === 'not') {
    return allResults.length > 0 ? !allResults[0] : true;
  }
  if (group.logicalOperator === 'or') {
    return allResults.some(Boolean);
  }
  return allResults.every(Boolean);
};

const evaluateRuleConditions = (groups, conditions, context) => {
  if (!groups.length) return true;

  const conditionsByGroup = new Map();
  for (const c of conditions) {
    const key = c.groupId.toString();
    if (!conditionsByGroup.has(key)) conditionsByGroup.set(key, []);
    conditionsByGroup.get(key).push(c);
  }

  const childGroupsByParent = new Map();
  const rootGroups = [];
  for (const g of groups) {
    if (g.isRoot || !g.parentGroupId) {
      rootGroups.push(g);
    } else {
      const key = g.parentGroupId.toString();
      if (!childGroupsByParent.has(key)) childGroupsByParent.set(key, []);
      childGroupsByParent.get(key).push(g);
    }
  }

  if (!rootGroups.length) rootGroups.push(groups[0]);
  return rootGroups.every((g) => evaluateGroup(g, conditionsByGroup, childGroupsByParent, context));
};

module.exports = {
  getFieldValue,
  evaluateSingleCondition,
  evaluateRuleConditions,
};
