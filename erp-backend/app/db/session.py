from collections.abc import AsyncGenerator
import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.exceptions import translate_integrity_error

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
logger = logging.getLogger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
            post_commit_hooks = session.info.pop("post_commit_hooks", [])
            for hook in post_commit_hooks:
                try:
                    await hook()
                except Exception:  # noqa: BLE001
                    logger.exception("post-commit hook failed")
        except IntegrityError as exc:
            await session.rollback()
            translated = translate_integrity_error(exc)
            if translated is not None:
                raise translated from exc
            raise
        except Exception:
            await session.rollback()
            raise
