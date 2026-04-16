import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = ZoneInfo("Asia/Shanghai")
DEMO_JOB_ID = "certificate-expiry-placeholder"
_scheduler: AsyncIOScheduler | None = None


async def certificate_expiry_placeholder() -> None:
    """证书到期检测占位任务，后续 Story 5.2 会替换为真实逻辑。"""
    logger.info("Running scheduled job: %s", DEMO_JOB_ID)


def register_demo_jobs(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(
        certificate_expiry_placeholder,
        trigger="interval",
        hours=24,
        id=DEMO_JOB_ID,
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )


def init_scheduler(app: FastAPI) -> AsyncIOScheduler:
    """初始化定时任务调度器，并注册基础演示任务。"""
    global _scheduler

    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone=DEFAULT_TIMEZONE)
        register_demo_jobs(_scheduler)

    if not _scheduler.running:
        _scheduler.start()

    app.state.scheduler = _scheduler
    return _scheduler


def shutdown_scheduler(app: FastAPI | None = None) -> None:
    """关闭调度器，释放全局和 app.state 引用。"""
    global _scheduler

    scheduler = _scheduler
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)

    if app is not None and hasattr(app.state, "scheduler"):
        delattr(app.state, "scheduler")

    _scheduler = None


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


__all__ = ["DEMO_JOB_ID", "get_scheduler", "init_scheduler", "shutdown_scheduler"]
