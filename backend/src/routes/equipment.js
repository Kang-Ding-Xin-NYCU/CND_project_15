const { statusText } = require("../constants");
const { addAudit, machineById, nowText } = require("../domain");
const { parseJsonBody, requireFields, sendJson } = require("../http-utils");

async function handleEquipmentRoutes(req, res, pathname, store) {
  const equipmentStatusMatch = pathname.match(/^\/api\/equipment\/([^/]+)\/status$/);
  if (req.method === "POST" && equipmentStatusMatch) {
    const [, equipmentId] = equipmentStatusMatch;
    const body = await parseJsonBody(req);
    requireFields(body, ["status"]);
    const payload = await store.update((state) => {
      const machine = machineById(state, decodeURIComponent(equipmentId));
      if (!machine) {
        const error = new Error("Equipment not found");
        error.statusCode = 404;
        throw error;
      }
      machine.status = body.status;
      if (body.status === "alarm") {
        const alarmId = `ALM-${String(state.alarmSeq).padStart(3, "0")}`;
        state.alarmSeq += 1;
        state.alarms.unshift({
          id: alarmId,
          equipmentId: machine.id,
          severity: body.severity || "Medium",
          message: body.message || `${machine.name} 狀態異常，請確認機台訊號與保養紀錄。`,
          status: "alarm",
          createdAt: nowText()
        });
      }
      addAudit(state, `${machine.name} 狀態更新為 ${statusText[body.status] || body.status}`, body.actor || "Lab Operator");
      return { message: `${machine.name} 已更新` };
    });
    sendJson(res, 200, payload);
    return true;
  }

  return false;
}

module.exports = {
  handleEquipmentRoutes
};
