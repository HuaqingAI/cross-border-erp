# 导入所有 SQLAlchemy Model，用于 Alembic 自动检测
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.certificate import (  # noqa: F401
    Certificate,
    CertificateCategoryAssignment,
    CertificateSPUAssignment,
)
from app.models.faq import FAQ  # noqa: F401
from app.models.product_category import ProductCategory  # noqa: F401
from app.models.product_document import (  # noqa: F401
    ProductDocument,
    ProductDocumentAttachment,
    ProductDocumentCategoryAssignment,
    ProductDocumentSKUAssignment,
)
from app.models.sku import SKU, SKUPackageDetail, SKUImage  # noqa: F401
from app.models.spu import SPU, SPUInvoiceInfo  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "AuditLog",
    "Certificate",
    "CertificateSPUAssignment",
    "CertificateCategoryAssignment",
    "FAQ",
    "ProductCategory",
    "ProductDocument",
    "ProductDocumentSKUAssignment",
    "ProductDocumentCategoryAssignment",
    "ProductDocumentAttachment",
    "SKU",
    "SKUPackageDetail",
    "SKUImage",
    "SPU",
    "SPUInvoiceInfo",
    "User",
]
