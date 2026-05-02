const { addAudit, nowText, requestById } = require("../domain");
const { parseJsonBody, requireFields, sendJson } = require("../http-utils");

async function handleRequestRoutes(req, res, pathname, store) {
  if (req.method === "POST" && pathname === "/api/requests") {
    const body = await parseJsonBody(req);
    requireFields(body, ["requester", "department", "labType", "priority", "dueDate", "sampleCode", "material", "quantity", "goal"]);
    const payload = await store.update((state) => {
      const id = `REQ-2026-${String(state.requestSeq).padStart(3, "0")}`;
      state.requestSeq += 1;
      const request = {
        id,
        requester: String(body.requester).trim(),
        department: String(body.department).trim(),
        labType: String(body.labType).trim(),
        priority: String(body.priority).trim(),
        dueDate: String(body.dueDate).trim(),
        goal: String(body.goal).trim(),
        status: "pending_approval",
        samples: [
          {
            id: String(body.sampleCode).trim(),
            material: String(body.material).trim(),
            quantity: Number(body.quantity),
            status: "created"
          }
        ],
        wips: []
      };
      state.requests.unshift(request);
      addAudit(state, `${id} 由 ${request.requester} 建立並送出簽核`, request.requester);
      return { message: `${id} 已送出簽核` };
    });
    sendJson(res, 201, payload);
    return true;
  }

  const requestActionMatch = pathname.match(/^\/api\/requests\/([^/]+)\/(approve|reject|receive|split|close)$/);
  if (req.method === "POST" && requestActionMatch) {
    const [, requestId, action] = requestActionMatch;
    const body = await parseJsonBody(req);
    const payload = await store.update((state) => {
      const request = requestById(state, decodeURIComponent(requestId));
      if (!request) {
        const error = new Error("Request not found");
        error.statusCode = 404;
        throw error;
      }

      if (action === "approve") {
        request.status = "approved";
        addAudit(state, `${request.id} 已由主管核准`, body.actor || "Lab Supervisor");
        return { message: `${request.id} 已核准，可進行收件` };
      }

      if (action === "reject") {
        request.status = "rejected";
        request.rejectReason = body.reason || "請補充樣品或實驗條件";
        addAudit(state, `${request.id} 已退回申請人補件`, body.actor || "Lab Supervisor");
        return { message: `${request.id} 已退回` };
      }

      if (action === "receive") {
        request.status = "received";
        request.receivedAt = nowText();
        request.samples.forEach((sample) => {
          sample.status = "received";
        });
        addAudit(state, `${request.id} 實驗室完成收件`, body.actor || "Lab Operator");
        return { message: `${request.id} 已收件，可分貨或派貨` };
      }

      if (action === "split") {
        const source = request.samples[0];
        if (!source) {
          const error = new Error("No sample to split");
          error.statusCode = 409;
          throw error;
        }
        request.status = "split";
        source.status = "split";
        if (!request.wips.length) {
          const total = Math.max(1, Number(source.quantity) || 1);
          const firstQty = total === 1 ? 1 : Math.floor(total / 2);
          const secondQty = total - firstQty;
          request.wips = [
            { id: `${source.id}-A`, source: source.id, quantity: firstQty, purpose: `${request.labType} primary`, status: "queued" }
          ];
          if (secondQty > 0) {
            request.wips.push({ id: `${source.id}-B`, source: source.id, quantity: secondQty, purpose: `${request.labType} backup`, status: "queued" });
          }
        }
        addAudit(state, `${request.id} 已分貨為 ${request.wips.map((wip) => wip.id).join(", ")}`, body.actor || "Lab Operator");
        return { message: `${request.id} 已建立 WIP` };
      }

      request.status = "closed";
      request.closedAt = nowText();
      addAudit(state, `${request.id} 已結案`, body.actor || "Lab Operator");
      return { message: `${request.id} 已結案` };
    });
    sendJson(res, 200, payload);
    return true;
  }

  return false;
}

module.exports = {
  handleRequestRoutes
};
