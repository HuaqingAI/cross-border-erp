import type { CSSProperties, ReactNode } from 'react'
import SectionTitle from './SectionTitle'

interface FormSectionCardProps {
  title: string
  children: ReactNode
  style?: CSSProperties
  bodyStyle?: CSSProperties
}

export default function FormSectionCard({
  title,
  children,
  style,
  bodyStyle,
}: FormSectionCardProps) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 4,
        border: '1px solid #f0f0f0',
        padding: 16,
        ...style,
      }}
    >
      <SectionTitle title={title} />
      <div
        style={{
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </section>
  )
}
