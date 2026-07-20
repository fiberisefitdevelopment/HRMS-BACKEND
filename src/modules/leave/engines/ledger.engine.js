const LeaveBalance = require('../leaveBalance.model');
const leaveLedgerRepository = require('../leaveLedger.repository');
const ApiError = require('../../../utils/ApiError');

const getOrCreateBalance = async (employeeProfileId, userId, companyId, leaveType, leaveTypeCode) => {
  let balance = await LeaveBalance.findOne(
    { companyId, employeeProfileId, leaveTypeCode: leaveTypeCode.toUpperCase() },
    null,
    { companyId }
  );

  if (!balance) {
    balance = await LeaveBalance.create({
      companyId,
      employeeProfileId,
      userId,
      leaveType,
      leaveTypeCode: leaveTypeCode.toUpperCase(),
      balance: 0,
    });

    await leaveLedgerRepository.create({
      companyId,
      employeeProfileId,
      userId,
      leaveType,
      leaveTypeCode: leaveTypeCode.toUpperCase(),
      transactionType: 'opening_balance',
      openingBalance: 0,
      credit: 0,
      debit: 0,
      adjustment: 0,
      closingBalance: 0,
      reason: 'Initial balance',
      referenceType: 'system',
      transactionDate: new Date(),
    });
  }

  return balance;
};

const getBalance = async (employeeProfileId, companyId, leaveTypeCode) => {
  const balance = await LeaveBalance.findOne(
    { companyId, employeeProfileId, leaveTypeCode: leaveTypeCode.toUpperCase() },
    null,
    { companyId }
  );
  return balance?.balance ?? 0;
};

const getAllBalances = async (employeeProfileId, companyId) => {
  const balances = await LeaveBalance.find({ companyId, employeeProfileId }, null, { companyId });
  const byCode = new Map(
    balances.map((b) => [String(b.leaveTypeCode).toUpperCase(), b])
  );

  let policyTypes = [];
  try {
    const policyEngine = require('./policy.engine');
    const policy = await policyEngine.getPolicy(companyId);
    policyTypes = (policy.leaveTypes || []).filter((lt) => lt.isActive !== false && lt.code);
  } catch {
    // Fall back to existing balance rows if policy is missing
  }

  if (policyTypes.length === 0) {
    return balances.map((b) => ({
      leaveType: b.leaveType,
      leaveTypeCode: b.leaveTypeCode,
      name: b.leaveType,
      balance: b.balance,
      lastCreditedAt: b.lastCreditedAt,
      lastDebitedAt: b.lastDebitedAt,
    }));
  }

  const rows = policyTypes.map((lt) => {
    const code = String(lt.code).toUpperCase();
    const existing = byCode.get(code);
    byCode.delete(code);
    return {
      leaveType: lt.leaveType || existing?.leaveType || lt.name || code,
      leaveTypeCode: code,
      name: lt.name || lt.leaveType || code,
      balance: existing?.balance ?? 0,
      lastCreditedAt: existing?.lastCreditedAt ?? null,
      lastDebitedAt: existing?.lastDebitedAt ?? null,
    };
  });

  // Include any orphan balance rows not in the current policy
  for (const [, b] of byCode) {
    rows.push({
      leaveType: b.leaveType,
      leaveTypeCode: b.leaveTypeCode,
      name: b.leaveType,
      balance: b.balance,
      lastCreditedAt: b.lastCreditedAt,
      lastDebitedAt: b.lastDebitedAt,
    });
  }

  return rows;
};

const recordTransaction = async ({
  companyId,
  employeeProfileId,
  userId,
  leaveType,
  leaveTypeCode,
  transactionType,
  credit = 0,
  debit = 0,
  adjustment = 0,
  reason,
  referenceType,
  referenceId,
  createdBy = null,
  transactionDate = new Date(),
  allowNegative = false,
}) => {
  const balanceDoc = await getOrCreateBalance(employeeProfileId, userId, companyId, leaveType, leaveTypeCode);
  const openingBalance = balanceDoc.balance;

  let closingBalance = openingBalance;
  if (transactionType === 'credit') closingBalance += credit;
  else if (transactionType === 'debit') closingBalance -= debit;
  else if (transactionType === 'adjustment') closingBalance += adjustment;
  else if (transactionType === 'opening_balance') closingBalance = adjustment;

  if (!allowNegative && closingBalance < 0) {
    throw ApiError.badRequest(`Insufficient ${leaveTypeCode} balance. Available: ${openingBalance}`);
  }

  const ledgerEntry = await leaveLedgerRepository.create({
    companyId,
    employeeProfileId,
    userId,
    leaveType,
    leaveTypeCode: leaveTypeCode.toUpperCase(),
    transactionType,
    openingBalance,
    credit,
    debit,
    adjustment,
    closingBalance,
    reason,
    referenceType,
    referenceId,
    transactionDate,
    createdBy,
  });

  const updateFields = {
    balance: closingBalance,
    lastTransactionId: ledgerEntry._id,
  };
  if (credit > 0) updateFields.lastCreditedAt = transactionDate;
  if (debit > 0) updateFields.lastDebitedAt = transactionDate;

  await LeaveBalance.findByIdAndUpdate(balanceDoc._id, updateFields);

  return { ledgerEntry, closingBalance };
};

const creditLeave = async (params) =>
  recordTransaction({ ...params, transactionType: 'credit', credit: params.amount });

const debitLeave = async (params) =>
  recordTransaction({ ...params, transactionType: 'debit', debit: params.amount });

const adjustBalance = async (params) =>
  recordTransaction({ ...params, transactionType: 'adjustment', adjustment: params.amount });

const resetBalance = async ({ companyId, employeeProfileId, userId, leaveType, leaveTypeCode, newBalance, reason, referenceType, referenceId, createdBy }) => {
  const balanceDoc = await getOrCreateBalance(employeeProfileId, userId, companyId, leaveType, leaveTypeCode);
  const adjustment = newBalance - balanceDoc.balance;
  return adjustBalance({
    companyId,
    employeeProfileId,
    userId,
    leaveType,
    leaveTypeCode,
    amount: adjustment,
    adjustment,
    reason,
    referenceType,
    referenceId,
    createdBy,
    allowNegative: false,
  });
};

module.exports = {
  getOrCreateBalance,
  getBalance,
  getAllBalances,
  recordTransaction,
  creditLeave,
  debitLeave,
  adjustBalance,
  resetBalance,
};
