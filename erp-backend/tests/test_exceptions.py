import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.exceptions import BusinessError, register_exception_handlers


@pytest.fixture
def test_app():
    """创建带有异常处理的测试应用"""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise-business-error")
    async def raise_business():
        raise BusinessError(message="商品不存在", code="NOT_FOUND", status_code=404)

    @app.get("/raise-generic-error")
    async def raise_generic():
        raise ValueError("unexpected error")

    return app


@pytest.mark.asyncio
async def test_business_error_returns_error_response(test_app):
    """BusinessError 应被转换为标准 ErrorResponse JSON"""
    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="http://test"
    ) as client:
        response = await client.get("/raise-business-error")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "NOT_FOUND"
    assert body["message"] == "商品不存在"


@pytest.mark.asyncio
async def test_generic_error_handler_returns_500_response():
    """generic_error_handler 应直接返回 500 INTERNAL_ERROR JSON 响应"""
    from unittest.mock import MagicMock
    from fastapi import Request
    from app.core.exceptions import register_exception_handlers

    # 直接测试 handler 函数，绕开 Starlette ServerErrorMiddleware 的重新抛出行为
    inner_app = FastAPI()
    register_exception_handlers(inner_app)

    # 找到注册的 generic handler
    generic_handler = inner_app.exception_handlers.get(Exception)
    assert generic_handler is not None, "Exception handler should be registered"

    mock_request = MagicMock(spec=Request)
    response = await generic_handler(mock_request, ValueError("unexpected error"))
    assert response.status_code == 500
    import json
    body = json.loads(response.body)
    assert body["code"] == "INTERNAL_ERROR"
    assert body["message"] == "服务器内部错误"


def test_business_error_attributes():
    """BusinessError 应正确设置属性"""
    err = BusinessError(message="测试错误", code="TEST_CODE", status_code=422)
    assert err.message == "测试错误"
    assert err.code == "TEST_CODE"
    assert err.status_code == 422


def test_business_error_default_attributes():
    """BusinessError 应有默认 code 和 status_code"""
    err = BusinessError(message="默认错误")
    assert err.code == "BUSINESS_ERROR"
    assert err.status_code == 400
