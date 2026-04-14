from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：初始化 scheduler 等（Story 1.6 填充）
    yield
    # 关闭时：停止 scheduler 等（Story 1.6 填充）


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

# Router 注册（后续各 Story 添加）
# from app.routers import auth
# app.include_router(auth.router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, Any]:
    return {"status": "ok"}
