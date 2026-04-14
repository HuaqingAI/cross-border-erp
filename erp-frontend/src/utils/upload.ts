// 文件上传工具函数占位
// SKU 图片上传 Story 将实现完整上传逻辑

export interface UploadResult {
  url: string
  filename: string
}

export async function uploadFile(_file: File): Promise<UploadResult> {
  throw new Error('文件上传功能将在 SKU 图片上传 Story 中实现')
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  return imageExtensions.includes(getFileExtension(filename))
}
