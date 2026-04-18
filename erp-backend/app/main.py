from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.scheduler import init_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_scheduler(app)
    try:
        yield
    finally:
        shutdown_scheduler(app)


app = FastAPI(
    title="Cross-Border ERP",
    description="跨境ERP系统 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Router 注册
from app.routers import auth as auth_router  # noqa: E402
from app.routers import files as files_router  # noqa: E402
from app.routers import product_categories as product_categories_router  # noqa: E402
from app.routers import skus as skus_router  # noqa: E402
from app.routers import spus as spus_router  # noqa: E402

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(files_router.router, prefix="/api/v1")
app.include_router(product_categories_router.router, prefix="/api/v1")
app.include_router(skus_router.router, prefix="/api/v1")
app.include_router(spus_router.router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, Any]:
    return {"status": "ok"}
