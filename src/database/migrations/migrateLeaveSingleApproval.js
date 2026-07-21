const Company = require('../../modules/companies/company.model');
const CompanyLeavePolicy = require('../../modules/leave-policies/companyLeavePolicy.model');
const WorkflowTemplate = require('../../modules/workflow/workflowTemplate.model');
const WorkflowLevel = require('../../modules/workflow/workflowLevel.model');
const WorkflowEscalation = require('../../modules/workflow/workflowEscalation.model');
const WorkflowInstance = require('../../modules/workflow/workflowInstance.model');
const LeaveRequest = require('../../modules/leave/leaveRequest.model');
const { resolveLeaveApprovers } = require('../../modules/workflow/engines/approverResolver.engine');
const { invokeCallback } = require('../../modules/workflow/registry/moduleCallback.registry');
const { dbLogger } = require('../../config/logger');
const { hasMigrationRun, markMigrationRun } = require('./migrationState');

const finalizeApprovedLeave = async (instance, companyId) => {
  const leave = await LeaveRequest.findOne({ _id: instance.entityId, companyId }, null, { companyId });
  if (!leave || leave.status === 'approved') return;

  const actorId =
    instance.levelStates?.find((ls) => ls.levelOrder === 1)?.approvedBy?.[0] ||
    instance.currentApproverIds?.[0] ||
    leave.managerId;

  await invokeCallback('leave', 'onApproved', {
    instance,
    companyId,
    entityId: instance.entityId,
    entityType: instance.entityType,
    actorId,
  });
};

const migrateLeaveSingleApproval = async () => {
  if (await hasMigrationRun('leave_single_approval_v1')) return;

  const companies = await Company.find({});

  for (const company of companies) {
    await CompanyLeavePolicy.updateMany(
      { companyId: company._id },
      {
        $set: {
          'approvalWorkflow.stages': ['manager'],
          'approvalWorkflow.hrFinalApproval': false,
        },
      }
    );

    const template = await WorkflowTemplate.findOne(
      { companyId: company._id, workflowType: 'leave', isDefault: true, status: 'active' },
      null,
      { companyId: company._id }
    );
    if (!template) continue;

    await WorkflowLevel.deleteMany({ companyId: company._id, templateId: template._id, levelOrder: { $gt: 1 } });
    await WorkflowEscalation.deleteMany({ companyId: company._id, templateId: template._id });

    let level = await WorkflowLevel.findOne(
      { companyId: company._id, templateId: template._id, levelOrder: 1 },
      null,
      { companyId: company._id }
    );

    if (!level) {
      level = await WorkflowLevel.create({
        companyId: company._id,
        templateId: template._id,
        name: 'Leave Approval',
        levelOrder: 1,
        approverType: 'leave_approver',
        approvalMode: 'sequential',
        status: 'active',
      });
    } else {
      level.name = 'Leave Approval';
      level.approverType = 'leave_approver';
      level.approvalMode = 'sequential';
      level.status = 'active';
      await level.save();
    }

    await WorkflowTemplate.updateOne(
      { _id: template._id },
      {
        $set: {
          description: 'Single-step leave approval by manager, HR, or owner',
          'config.approvalMode': 'sequential',
        },
      },
      { companyId: company._id }
    );

    const pendingInstances = await WorkflowInstance.find(
      {
        companyId: company._id,
        workflowType: 'leave',
        status: { $in: ['pending', 'escalated', 'delegated'] },
      },
      null,
      { companyId: company._id }
    );

    for (const instance of pendingInstances) {
      const level1 = (instance.levelStates || []).find((ls) => ls.levelOrder === 1);
      const managerAlreadyApproved = level1?.status === 'approved';

      if (managerAlreadyApproved) {
        await WorkflowInstance.updateOne(
          { _id: instance._id },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              currentLevelOrder: 1,
              currentApproverIds: [],
            },
          },
          { companyId: company._id }
        );
        await finalizeApprovedLeave(instance, company._id);
        continue;
      }

      const approverIds = await resolveLeaveApprovers(
        company._id,
        instance.employeeProfileId,
        instance.departmentId
      );

      const updatedLevelState = {
        levelId: level._id,
        levelOrder: 1,
        name: 'Leave Approval',
        approverType: 'leave_approver',
        approvalMode: 'sequential',
        assignedApproverIds: approverIds,
        approvedBy: level1?.approvedBy || [],
        status: 'pending',
        startedAt: level1?.startedAt || new Date(),
        dueAt: level1?.dueAt || null,
      };

      await WorkflowInstance.updateOne(
        { _id: instance._id },
        {
          $set: {
            currentLevelOrder: 1,
            currentApproverIds: approverIds,
            levelStates: [updatedLevelState],
          },
        },
        { companyId: company._id }
      );
    }

    const stuckPendingLeaves = await LeaveRequest.find(
      {
        companyId: company._id,
        status: 'pending',
        currentApprovalStage: 'hr',
      },
      null,
      { companyId: company._id }
    );

    for (const leave of stuckPendingLeaves) {
      const instance = await WorkflowInstance.findOne(
        { companyId: company._id, entityType: 'leave_request', entityId: leave._id },
        null,
        { companyId: company._id }
      );
      if (!instance) continue;

      const level1State = (instance.levelStates || []).find((ls) => ls.levelOrder === 1);
      if (level1State?.status === 'approved') {
        await finalizeApprovedLeave(instance, company._id);
      }
    }
  }

  dbLogger.info('Leave single-approval migration completed');
  await markMigrationRun('leave_single_approval_v1');
};

module.exports = { migrateLeaveSingleApproval };
