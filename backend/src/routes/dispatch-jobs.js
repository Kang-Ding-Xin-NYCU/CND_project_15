const {
  addAudit,
  dispatchableItems,
  equipmentName,
  jobById,
  machineById,
  nowText,
  recipeById,
  recipeName,
  requestById,
  setItemStatus
} = require("../domain");
const { parseJsonBody, requireFields, sendJson } = require("../http-utils");

async function handleDispatchJobRoutes(req, res, pathname, store) {
  if (req.method === "POST" && pathname === "/api/dispatch-jobs") {
    const body = await parseJsonBody(req);
    requireFields(body, ["requestId", "wipId", "equipmentId", "recipeId"]);
    const payload = await store.update((state) => {
      const request = requestById(state, body.requestId);
      const machine = machineById(state, body.equipmentId);
      const recipe = recipeById(state, body.recipeId);
      if (!request || !machine || !recipe) {
        const error = new Error("Request, equipment, or recipe not found");
        error.statusCode = 404;
        throw error;
      }
      if (!dispatchableItems(request).some((item) => item.id === body.wipId)) {
        const error = new Error("Selected WIP/sample does not belong to request");
        error.statusCode = 409;
        throw error;
      }
      if (machine.status === "maintenance" || machine.status === "alarm") {
        const error = new Error("Equipment is not dispatchable");
        error.statusCode = 409;
        throw error;
      }

      const id = `JOB-2026-${String(state.jobSeq).padStart(3, "0")}`;
      state.jobSeq += 1;
      const actor = body.operator || "Lab Operator";
      const job = {
        id,
        requestId: request.id,
        wipId: body.wipId,
        equipmentId: machine.id,
        recipeId: recipe.id,
        operator: actor,
        status: "queued",
        note: String(body.note || "").trim(),
        history: [{ action: "dispatch", actor, occurredAt: nowText(), note: "派貨" }]
      };
      state.jobs.unshift(job);
      request.status = "in_progress";
      setItemStatus(request, body.wipId, "queued");
      addAudit(state, `${request.id} 建立派貨任務 ${id}，目標機台 ${machine.name}`, actor);
      return { message: `${id} 已建立` };
    });
    sendJson(res, 201, payload);
    return true;
  }

  const jobActionMatch = pathname.match(/^\/api\/dispatch-jobs\/([^/]+)\/(load|unload)$/);
  if (req.method === "POST" && jobActionMatch) {
    const [, jobId, action] = jobActionMatch;
    const body = await parseJsonBody(req);
    const payload = await store.update((state) => {
      const job = jobById(state, decodeURIComponent(jobId));
      if (!job) {
        const error = new Error("Job not found");
        error.statusCode = 404;
        throw error;
      }
      const request = requestById(state, job.requestId);
      const machine = machineById(state, job.equipmentId);
      const actor = body.actor || job.operator || "Lab Operator";

      if (action === "load") {
        job.status = "running";
        job.history.push({ action: "load", actor, occurredAt: nowText(), note: "上貨" });
        if (machine) {
          machine.status = "busy";
          machine.utilization = Math.min(96, Number(machine.utilization) + 8);
        }
        if (request) {
          request.status = "in_progress";
          setItemStatus(request, job.wipId, "loaded");
        }
        addAudit(state, `${job.id} 已上貨並開始實驗`, actor);
        return { message: `${job.id} 已上貨` };
      }

      job.status = "completed";
      job.history.push({ action: "unload", actor, occurredAt: nowText(), note: "下貨與數據回收" });
      if (machine) {
        machine.status = "idle";
        machine.utilization = Math.min(99, Number(machine.utilization) + 5);
      }
      if (request) {
        request.status = "closed";
        request.closedAt = nowText();
        setItemStatus(request, job.wipId, "processed");
      }
      const resultId = `RST-${job.id.replace("JOB-", "")}`;
      if (!state.results.some((result) => result.id === resultId)) {
        state.results.unshift({
          id: resultId,
          requestId: job.requestId,
          jobId: job.id,
          summary: `${equipmentName(state, job.equipmentId)} 已依 ${recipeName(state, job.recipeId)} 完成實驗，系統自動回收 raw data 並自動結案。`,
          rawData: `s3://lims-demo/raw/${job.id}.csv`,
          report: `s3://lims-demo/report/${job.requestId}.pdf`,
          createdAt: nowText()
        });
      }
      addAudit(state, `${job.id} 完成下貨，實驗數據已回收並自動結案`, actor);
      return { message: `${job.id} 已完成，資料已回收並自動結案` };
    });
    sendJson(res, 200, payload);
    return true;
  }

  return false;
}

module.exports = {
  handleDispatchJobRoutes
};
