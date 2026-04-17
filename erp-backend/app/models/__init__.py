# 导入所有 SQLAlchemy Model，用于 Alembic 自动检测
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.product_category import ProductCategory  # noqa: F401
from app.models.sku import SKU, SKUPackageDetail  # noqa: F401
from app.models.spu import SPU, SPUInvoiceInfo  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "AuditLog",
    "ProductCategory",
    "SKU",
    "SKUPackageDetail",
    "SPU",
    "SPUInvoiceInfo",
    "User",
]
