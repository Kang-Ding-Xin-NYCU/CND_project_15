const { addAudit, machineById } = require("../domain");
const { parseJsonBody, requireFields, sendJson } = require("../http-utils");

async function handleRecipeRoutes(req, res, pathname, store) {
  if (req.method === "POST" && pathname === "/api/recipes") {
    const body = await parseJsonBody(req);
    requireFields(body, ["equipmentId", "name", "version", "parameters"]);
    const payload = await store.update((state) => {
      if (!machineById(state, body.equipmentId)) {
        const error = new Error("Equipment not found");
        error.statusCode = 404;
        throw error;
      }
      const id = `RCP-${String(state.recipeSeq).padStart(3, "0")}`;
      state.recipeSeq += 1;
      state.recipes.unshift({
        id,
        equipmentId: body.equipmentId,
        name: String(body.name).trim(),
        version: String(body.version).trim(),
        parameters: String(body.parameters).trim(),
        active: true
      });
      addAudit(state, `${id} Recipe 已建立`, body.actor || "System Admin");
      return { message: `${id} 已新增` };
    });
    sendJson(res, 201, payload);
    return true;
  }

  return false;
}

module.exports = {
  handleRecipeRoutes
};
