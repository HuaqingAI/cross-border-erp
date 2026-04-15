import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """健康检查端点应返回 200 和 ok 状态"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
