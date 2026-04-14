# OSS/MinIO 封装占位
# 本文件为占位，后续 Story（产品图片上传等）将填充实际实现


async def upload_file(file_data: bytes, filename: str, content_type: str) -> str:
    """上传文件到 MinIO — 后续 Story 将实现此方法"""
    raise NotImplementedError("文件上传功能将在图片上传 Story 中实现")


async def delete_file(object_name: str) -> None:
    """从 MinIO 删除文件 — 后续 Story 将实现此方法"""
    raise NotImplementedError("文件删除功能将在图片上传 Story 中实现")


def get_file_url(object_name: str) -> str:
    """获取文件访问 URL — 后续 Story 将实现此方法"""
    raise NotImplementedError("获取文件 URL 功能将在图片上传 Story 中实现")
