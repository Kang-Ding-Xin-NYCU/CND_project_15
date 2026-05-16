from typing import Any

from ..domain import add_audit, machine_by_id
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
        if not machine_by_id(state, equipment_id):
            raise ApiError("Equipment not found", 404)
        recipe_id = f"RCP-{state['recipeSeq']:03d}"
        state["recipeSeq"] += 1
        state["recipes"].insert(
            0,
            {
                "id": recipe_id,
                "equipmentId": equipment_id,
                "name": name,
                "version": version,
                "parameters": parameters,
                "active": True,
            },
        )
        add_audit(state, f"{recipe_id} recipe created", actor)
        return {"message": f"{recipe_id} created"}

    return store.update(mutate)
