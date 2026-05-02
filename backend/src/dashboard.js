function createDashboard(state) {
  return {
    pendingApproval: state.requests.filter((item) => item.status === "pending_approval").length,
    pendingReceive: state.requests.filter((item) => item.status === "approved").length,
    runningJobs: state.jobs.filter((job) => ["queued", "loaded", "running"].includes(job.status)).length,
    activeAlarms: state.alarms.filter((alarm) => alarm.status === "alarm").length,
    equipmentUtilization: state.equipment.map((machine) => ({
      id: machine.id,
      name: machine.name,
      utilization: machine.utilization,
      status: machine.status
    })),
    requestByStatus: state.requests.reduce((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {}),
    operatorActions: state.audit.slice(0, 20)
  };
}

module.exports = {
  createDashboard
};
