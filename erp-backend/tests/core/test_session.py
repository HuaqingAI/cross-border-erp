from app.db.session import engine


def test_engine_enables_pool_pre_ping():
    assert engine.sync_engine.pool._pre_ping is True


def test_engine_sets_pool_recycle_seconds():
    assert engine.sync_engine.pool._recycle == 1800
