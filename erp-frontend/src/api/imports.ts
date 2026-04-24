import apiClient from './client'
import type {
  ImportConfirmPayload,
  ImportConfirmResult,
  ImportTaskProgress,
  ImportTaskType,
  ImportValidationResult,
} from '../types/product'

function extractFilename(contentDisposition?: string): string {
  if (!contentDisposition) {
    return 'import-template.xlsx'
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  if (basicMatch?.[1]) {
    return basicMatch[1]
  }

  return 'import-template.xlsx'
}

export const importsApi = {
  downloadTemplate: async (importType: ImportTaskType) => {
    const response = await apiClient.get<Blob>(`/import/templates/${importType}`, {
      responseType: 'blob',
    })

    return {
      blob: response.data,
      filename: extractFilename(response.headers['content-disposition']),
    }
  },

  validate: async (importType: ImportTaskType, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<ImportValidationResult>(`/import/${importType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return response.data
  },

  confirm: (importType: ImportTaskType, payload: ImportConfirmPayload) =>
    apiClient
      .post<ImportConfirmResult>(`/import/${importType}/confirm`, payload)
      .then((response) => response.data),

  getTaskProgress: (taskId: number) =>
    apiClient
      .get<ImportTaskProgress>(`/import/tasks/${taskId}`)
      .then((response) => response.data),
}
