import { useQuery } from '@tanstack/react-query'
import { enumsApi } from '../api/enums'
import type { SystemEnumGroupKey, SystemEnumItem } from '../types/product'

export interface EnumOption {
  label: string
  value: string
}

interface ExtraEnumOption {
  label?: string | null
  value: string
}

export function buildEnumOptions(
  items: SystemEnumItem[] | undefined,
  extraOptions: ExtraEnumOption[] = [],
): EnumOption[] {
  const options = new Map<string, string>()

  for (const item of items ?? []) {
    options.set(item.enum_key, item.enum_value)
  }

  for (const option of extraOptions) {
    if (!options.has(option.value)) {
      options.set(option.value, option.label?.trim() || option.value)
    }
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
}

export function resolveEnumLabel(
  items: SystemEnumItem[] | undefined,
  value: string | null | undefined,
  fallback?: string | null,
): string {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return fallback?.trim() || '—'
  }

  const matched = items?.find((item) => item.enum_key === normalizedValue)
  return matched?.enum_value ?? fallback?.trim() ?? normalizedValue
}

export function useSystemEnumItems(
  group: SystemEnumGroupKey,
  enabled = true,
) {
  return useQuery({
    queryKey: ['system-enums', group, 'enabled'],
    queryFn: () =>
      enumsApi.list({
        group,
        include_disabled: false,
      }),
    enabled,
  })
}
