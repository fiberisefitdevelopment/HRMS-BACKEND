const conditionEvaluator = require('../../policy-engine/engines/conditionEvaluator.engine');
const WorkflowCondition = require('../workflowCondition.model');

const evaluateCondition = (condition, contextData) =>
  conditionEvaluator.evaluateSingleCondition(condition, contextData);

const applyConditions = async (templateId, companyId, levels, contextData) => {
  const conditions = await WorkflowCondition.find(
    { templateId, companyId, isActive: true },
    null,
    { companyId }
  ).sort({ priority: -1 });

  let resultLevels = [...levels];
  const levelsToAdd = [];
  const levelsToSkip = new Set();

  for (const condition of conditions) {
    if (!evaluateCondition(condition, contextData)) continue;

    switch (condition.action) {
      case 'skip_level':
        if (condition.targetLevelId) levelsToSkip.add(condition.targetLevelId.toString());
        break;
      case 'add_level':
      case 'require_level':
        if (condition.insertLevelId) {
          const insertLevel = resultLevels.find((l) => l._id.toString() === condition.insertLevelId.toString());
          if (insertLevel) levelsToAdd.push(insertLevel);
        }
        break;
      default:
        break;
    }
  }

  resultLevels = resultLevels.filter((l) => !levelsToSkip.has(l._id.toString()));
  resultLevels = [...resultLevels, ...levelsToAdd];
  resultLevels.sort((a, b) => a.levelOrder - b.levelOrder);

  return resultLevels;
};

module.exports = { evaluateCondition, applyConditions };
