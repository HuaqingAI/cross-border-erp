import { filesApi } from '../api/files'

export interface UploadResult {
  url: string
  filename: string
  fileKey: string
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const presigned = await filesApi.createPresignedUrl({
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    folder: 'sku-images',
  })

  const uploadResponse = await fetch(presigned.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error('文件上传失败')
  }

  return {
    url: presigned.file_url,
    filename: file.name,
    fileKey: presigned.file_key,
  }
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  return imageExtensions.includes(getFileExtension(filename))
}
