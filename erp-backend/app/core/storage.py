from __future__ import annotations

from datetime import timedelta
import json
from uuid import uuid4

from minio import Minio

from app.core.config import settings


def _build_client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def _set_public_read_policy(client: Minio, bucket_name: str) -> None:
    client.set_bucket_policy(
        bucket_name,
        json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{bucket_name}/*"],
                    }
                ],
            }
        ),
    )


def _ensure_bucket(
    client: Minio,
    bucket_name: str,
    *,
    public_read: bool = False,
) -> None:
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)
    if public_read:
        _set_public_read_policy(client, bucket_name)


def get_file_url(object_name: str, *, bucket_name: str = settings.MINIO_BUCKET) -> str:
    base_url = settings.MINIO_PUBLIC_ENDPOINT.rstrip("/")
    return f"{base_url}/{bucket_name}/{object_name}"


async def create_presigned_upload(
    *,
    filename: str,
    content_type: str,
    folder: str = "sku-images",
) -> tuple[str, str, str]:
    client = _build_client()
    bucket_name = settings.MINIO_SKU_IMAGE_BUCKET if folder == "sku-images" else settings.MINIO_BUCKET
    _ensure_bucket(
        client,
        bucket_name,
        public_read=folder == "sku-images",
    )

    extension = filename.split(".")[-1] if "." in filename else ""
    suffix = f".{extension}" if extension else ""
    object_key = f"{folder}/{uuid4().hex}{suffix}"
    upload_url = client.presigned_put_object(
        bucket_name,
        object_key,
        expires=timedelta(minutes=30),
    )
    return upload_url, object_key, get_file_url(object_key, bucket_name=bucket_name)


async def upload_file(file_data: bytes, filename: str, content_type: str) -> str:
    raise NotImplementedError("当前 Story 采用预签名直传，不走后端中转上传")


async def delete_file(object_name: str) -> None:
    client = _build_client()
    _ensure_bucket(client, settings.MINIO_SKU_IMAGE_BUCKET, public_read=True)
    client.remove_object(settings.MINIO_SKU_IMAGE_BUCKET, object_name)
