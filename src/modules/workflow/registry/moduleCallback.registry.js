const callbacks = new Map();

const registerWorkflowCallback = (workflowType, handlers) => {
  callbacks.set(workflowType, handlers);
};

const getWorkflowCallback = (workflowType) => callbacks.get(workflowType) || null;

const invokeCallback = async (workflowType, event, payload) => {
  const handler = callbacks.get(workflowType);
  if (!handler || typeof handler[event] !== 'function') return null;
  return handler[event](payload);
};

module.exports = { registerWorkflowCallback, getWorkflowCallback, invokeCallback };
