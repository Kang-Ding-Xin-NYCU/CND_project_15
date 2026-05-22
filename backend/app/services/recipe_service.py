from typing import Any

from ..domain import add_audit, machine_by_id, machine_type, recipe_by_id
from ..errors import ApiError


def create_recipe(
    store: Any,
    *,
    equipment_id: str,
    name: str,
    version: str,
    parameters: str,
    actor: str,
) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        machine = machine_by_id(state, equipment_id)
        if not machine:
            raise ApiError("Equipment not found", 404)
        recipe_id = f"RCP-{state['recipeSeq']:03d}"
        state["recipeSeq"] += 1
        state["recipes"].insert(
            0,
            {
                "id": recipe_id,
                "equipmentId": equipment_id,
                "equipmentType": machine_type(machine),
                "name": name,
                "version": version,
                "parameters": parameters,
                "active": True,
            },
        )
        add_audit(state, f"{recipe_id} recipe created", actor)
        return {"message": f"{recipe_id} created"}

    return store.update(mutate)


def deactivate_recipe(store: Any, *, recipe_id: str, actor: str) -> dict[str, Any]:
    def mutate(state: dict[str, Any]) -> dict[str, Any]:
        recipe = recipe_by_id(state, recipe_id)
        if not recipe:
            raise ApiError("Recipe not found", 404)
        recipe["active"] = False
        add_audit(state, f"{recipe['id']} deactivated", actor or "System Admin")
        return {"message": f"{recipe['id']} deactivated"}

    return store.update(mutate)
