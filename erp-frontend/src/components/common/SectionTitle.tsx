// src/components/common/SectionTitle.tsx
interface SectionTitleProps {
  title: string
  className?: string
}

export default function SectionTitle({ title, className }: SectionTitleProps) {
  return (
    <div
      role="heading"
      aria-level={3}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}
    >
      {/* 左侧 3px #C41D2E 红色竖线 */}
      <div
        style={{
          width: 3,
          height: 16,
          backgroundColor: '#C41D2E',
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      {/* 红色 16px 标题文字 */}
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#C41D2E',
          lineHeight: '16px',
        }}
      >
        {title}
      </span>
    </div>
  )
}
