const Company = require('../../modules/companies/company.model');
const WorkflowTemplate = require('../../modules/workflow/workflowTemplate.model');
const WorkflowLevel = require('../../modules/workflow/workflowLevel.model');
const WorkflowEscalation = require('../../modules/workflow/workflowEscalation.model');
const { dbLogger } = require('../../config/logger');

const DEFAULT_WORKFLOWS = [
  {
    name: 'Leave Approval',
    workflowType: 'leave',
    description: 'Single-step leave approval by manager, HR, or owner',
    levels: [
      { name: 'Leave Approval', levelOrder: 1, approverType: 'leave_approver' },
    ],
  },
  {
    name: 'Comp-off Approval',
    workflowType: 'comp_off',
    description: 'Single-step comp-off approval by reporting manager',
    levels: [
      { name: 'Manager Approval', levelOrder: 1, approverType: 'reporting_manager' },
    ],
  },
  {
    name: 'Attendance Regularization',
    workflowType: 'attendance_regularization',
    description: 'Manager then HR for attendance regularization',
    levels: [
      { name: 'Manager Approval', levelOrder: 1, approverType: 'reporting_manager', escalationHours: 24 },
      { name: 'HR Approval', levelOrder: 2, approverType: 'hr', escalationHours: 24 },
    ],
  },
  {
    name: 'Expense Approval',
    workflowType: 'expense',
    description: 'Manager, Finance parallel, then Owner',
    levels: [
      { name: 'Manager Approval', levelOrder: 1, approverType: 'reporting_manager' },
      { name: 'HR Review', levelOrder: 2, approverType: 'hr', approvalMode: 'parallel' },
      { name: 'Owner Approval', levelOrder: 3, approverType: 'owner' },
    ],
  },
];

const createWorkflowForCompany = async (company, wf) => {
  const template = await WorkflowTemplate.create({
    companyId: company._id,
    name: wf.name,
    workflowType: wf.workflowType,
    description: wf.description,
    isDefault: true,
    version: 1,
    status: 'active',
    config: {
      approvalMode: 'sequential',
      sequentialApproval: true,
      reminderHours: [24, 48, 72],
    },
  });

  for (const level of wf.levels) {
    const createdLevel = await WorkflowLevel.create({
      ...level,
      companyId: company._id,
      templateId: template._id,
      status: 'active',
    });

    if (level.escalationHours) {
      await WorkflowEscalation.create({
        companyId: company._id,
        templateId: template._id,
        levelId: createdLevel._id,
        escalateAfterHours: level.escalationHours,
        escalateToApproverType: 'hr',
        isActive: true,
      });
    }
  }

  return template;
};

/** Upsert comp_off workflow for companies that already have other templates. */
const ensureCompOffWorkflow = async () => {
  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });
  const compOffWf = DEFAULT_WORKFLOWS.find((w) => w.workflowType === 'comp_off');
  if (!compOffWf) return;

  let created = 0;
  for (const company of companies) {
    const existing = await WorkflowTemplate.findOne(
      { companyId: company._id, workflowType: 'comp_off' },
      null,
      { companyId: company._id }
    );
    if (existing) continue;

    await createWorkflowForCompany(company, compOffWf);
    created += 1;
  }

  if (created > 0) {
    dbLogger.info(`Upserted comp_off workflow for ${created} compan${created === 1 ? 'y' : 'ies'}`);
  }
};

const seedWorkflowTemplates = async () => {
  const existing = await WorkflowTemplate.countDocuments();
  if (existing > 0) {
    dbLogger.info('Workflow templates already seeded — ensuring comp_off');
    await ensureCompOffWorkflow();
    return;
  }

  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });

  for (const company of companies) {
    for (const wf of DEFAULT_WORKFLOWS) {
      await createWorkflowForCompany(company, wf);
    }
    dbLogger.info(`Seeded workflow templates for ${company.companyName}`);
  }
};

module.exports = { seedWorkflowTemplates, ensureCompOffWorkflow };
