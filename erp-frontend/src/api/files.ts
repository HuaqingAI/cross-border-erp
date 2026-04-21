import client from './client'

export interface PresignedUrlPayload {
  filename: string
  content_type: string
  folder?: string
}

export interface PresignedUrlResult {
  upload_url: string
  file_key: string
  file_url: string
}

export const filesApi = {
  async createPresignedUrl(payload: PresignedUrlPayload): Promise<PresignedUrlResult> {
    const response = await client.post<PresignedUrlResult>('/files/presigned-url', payload)
    return response.data
  },

  async deleteObject(objectKey: string): Promise<void> {
    await client.delete('/files/object', {
      params: {
        object_key: objectKey,
      },
    })
  },
}
