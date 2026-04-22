from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.schemas.common import ErrorDetail, ErrorResponse


class BusinessError(Exception):
    def __init__(self, message: str, code: str = "BUSINESS_ERROR", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


def translate_integrity_error(exc: IntegrityError) -> BusinessError | None:
    message = f"{exc}\n{getattr(exc, 'orig', '')}".lower()

    if (
        "ix_prices_active_sku_id" in message
        or "prices.active_sku_id" in message
    ):
        return BusinessError("该SKU已存在价格记录")

    if (
        "ix_price_regions_price_id_version_stage_active_country_code" in message
        or "ix_price_regions_price_id_active_country_code" in message
        or "price_regions.price_id, price_regions.active_country_code" in message
        or "price_regions.price_id, price_regions.version_stage, price_regions.active_country_code" in message
    ):
        return BusinessError("同一 SKU 同一国家/地区不可重复设置价格")

    return None


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BusinessError)
    async def business_error_handler(request: Request, exc: BusinessError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(code=exc.code, message=exc.message).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            ErrorDetail(
                field=".".join(str(loc) for loc in error["loc"]) if error.get("loc") else None,
                msg=error["msg"],
            )
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                code="VALIDATION_ERROR",
                message="请求参数验证失败",
                details=details,
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(code="INTERNAL_ERROR", message="服务器内部错误").model_dump(),
        )
