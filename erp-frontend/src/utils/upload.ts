import { filesApi } from '../api/files'

export interface UploadResult {
  url: string
  filename: string
  fileKey: string
}

interface UploadOptions {
  folder?: string
}

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const presigned = await filesApi.createPresignedUrl({
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    folder: options.folder ?? 'sku-images',
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

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
