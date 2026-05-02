function nowText() {
  return new Date().toLocaleString("zh-TW", { hour12: false });
}

function addAudit(state, message, actor = "System") {
  state.audit.unshift({ message, actor, occurredAt: nowText() });
}

function requestById(state, id) {
  return state.requests.find((request) => request.id === id);
}

function jobById(state, id) {
  return state.jobs.find((job) => job.id === id);
}

function machineById(state, id) {
  return state.equipment.find((machine) => machine.id === id);
}

function recipeById(state, id) {
  return state.recipes.find((recipe) => recipe.id === id);
}

function equipmentName(state, id) {
  return machineById(state, id)?.name || id;
}

function recipeName(state, id) {
  return recipeById(state, id)?.name || id;
}

function dispatchableItems(request) {
  return request.wips.length ? request.wips : request.samples;
}

function setItemStatus(request, itemId, status) {
  [...request.wips, ...request.samples].forEach((item) => {
    if (item.id === itemId) item.status = status;
  });
}

module.exports = {
  nowText,
  addAudit,
  requestById,
  jobById,
  machineById,
  recipeById,
  equipmentName,
  recipeName,
  dispatchableItems,
  setItemStatus
};
