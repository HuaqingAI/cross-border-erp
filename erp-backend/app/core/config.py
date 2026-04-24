from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 数据库
    DATABASE_URL: str = "mysql+aiomysql://root:password@db:3306/erp"

    # JWT（Story 1.2 使用）
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 360
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MinIO/OSS
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "erp-files"
    MINIO_SKU_IMAGE_BUCKET: str = "erp-sku-images"
    MINIO_SECURE: bool = False
    MINIO_REGION: str = "us-east-1"
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000"

    # 应用
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"


settings = Settings()
