"""Service layer: business logic that orchestrates domain helpers and the store.

Services are HTTP-agnostic — they take primitive inputs and the store/cache,
raise `ApiError` on business rule violations, and return plain dicts/lists.
Routers translate HTTP requests into service calls.
"""
