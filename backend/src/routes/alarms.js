const { addAudit, machineById, nowText } = require("../domain");
const { parseJsonBody, sendJson } = require("../http-utils");

async function handleAlarmRoutes(req, res, pathname, store) {
  const alarmAckMatch = pathname.match(/^\/api\/alarms\/([^/]+)\/ack$/);
  if (req.method === "POST" && alarmAckMatch) {
    const [, alarmId] = alarmAckMatch;
    const body = await parseJsonBody(req);
    const payload = await store.update((state) => {
      const alarm = state.alarms.find((item) => item.id === decodeURIComponent(alarmId));
      if (!alarm) {
        const error = new Error("Alarm not found");
        error.statusCode = 404;
        throw error;
      }
      alarm.status = "closed";
      alarm.acknowledgedAt = nowText();
      alarm.acknowledgedBy = body.actor || "Lab Operator";
      const machine = machineById(state, alarm.equipmentId);
      if (machine && machine.status === "alarm") machine.status = "maintenance";
      addAudit(state, `${alarm.id} 已確認處理`, alarm.acknowledgedBy);
      return { message: `${alarm.id} 已確認` };
    });
    sendJson(res, 200, payload);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/alarms/simulate") {
    const body = await parseJsonBody(req);
    const payload = await store.update((state) => {
      const machine = state.equipment.find((item) => item.status !== "alarm") || state.equipment[0];
      machine.status = "alarm";
      const alarmId = `ALM-${String(state.alarmSeq).padStart(3, "0")}`;
      state.alarmSeq += 1;
      state.alarms.unshift({
        id: alarmId,
        equipmentId: machine.id,
        severity: "Medium",
        message: `${machine.name} 狀態異常，請確認機台訊號與保養紀錄。`,
        status: "alarm",
        createdAt: nowText()
      });
      addAudit(state, `${machine.name} 產生模擬告警 ${alarmId}`, body.actor || "System");
      return { message: `${alarmId} 已建立` };
    });
    sendJson(res, 201, payload);
    return true;
  }

  return false;
}

module.exports = {
  handleAlarmRoutes
};
