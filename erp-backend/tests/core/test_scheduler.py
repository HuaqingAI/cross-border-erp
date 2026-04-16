import pytest

from app.core.scheduler import DEMO_JOB_ID, get_scheduler, init_scheduler, shutdown_scheduler
from app.main import app, lifespan


@pytest.mark.asyncio
async def test_init_scheduler_registers_demo_job():
    shutdown_scheduler(app)

    scheduler = init_scheduler(app)
    try:
        job = scheduler.get_job(DEMO_JOB_ID)

        assert scheduler.running
        assert getattr(app.state, "scheduler", None) is scheduler
        assert job is not None
        assert job.id == DEMO_JOB_ID
    finally:
        shutdown_scheduler(app)

    assert get_scheduler() is None
    assert not hasattr(app.state, "scheduler")


@pytest.mark.asyncio
async def test_lifespan_starts_and_stops_scheduler():
    shutdown_scheduler(app)

    async with lifespan(app):
        scheduler = get_scheduler()

        assert scheduler is not None
        assert scheduler.running
        assert getattr(app.state, "scheduler", None) is scheduler
        assert scheduler.get_job(DEMO_JOB_ID) is not None

    assert get_scheduler() is None
    assert not hasattr(app.state, "scheduler")
