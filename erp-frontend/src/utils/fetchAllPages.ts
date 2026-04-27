const DEFAULT_MAX_PAGES = 100

export interface PaginatedResponse<T> {
  items: T[]
  total: number
}

export class PaginatedFetchExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaginatedFetchExhaustedError'
  }
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  pageSize: number,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<T[]> {
  const items: T[] = []
  let page = 1
  let total = 0

  while (page <= maxPages) {
    const response = await fetchPage(page, pageSize)
    const previousLength = items.length

    items.push(...response.items)
    total = response.total

    if (items.length >= total) {
      return items
    }

    if (response.items.length === 0 || items.length === previousLength) {
      throw new PaginatedFetchExhaustedError(
        `分页聚合异常：第 ${page} 页未返回新数据，但 total=${total}，当前已加载 ${items.length} 条。`,
      )
    }

    page += 1
  }

  throw new PaginatedFetchExhaustedError(
    `分页聚合异常：超过最大页数 ${maxPages} 仍未加载完成。`,
  )
}
