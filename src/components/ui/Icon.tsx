/** Inline stroke icons. One shared 24x24 grid keeps optical weight consistent. */

const paths: Record<string, string> = {
  check: 'M4 12.5l5 5L20 6.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  flag: 'M6 21V4h12l-2.5 4L18 12H6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  calendar: 'M4 8h16M8 3v3M16 3v3M5.5 5h13A1.5 1.5 0 0120 6.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5v-13A1.5 1.5 0 015.5 5z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  note: 'M6 3h8l5 5v13H6zM14 3v5h5',
  folder: 'M4 7.5A1.5 1.5 0 015.5 6h3.6l1.8 2H18.5A1.5 1.5 0 0120 9.5v8A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z',
  tag: 'M3 11.5V4.5A1.5 1.5 0 014.5 3h7l9 9-8 8-9.5-8.5zM7.5 7.5h.01',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 7.5h.01',
  pin: 'M9 3h6l-1 6 4 3.5H6L10 9z M12 12.5V21',
  star: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z',
  gear: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 13.5l1.7 1.3-1.7 3-2-.8a7.7 7.7 0 01-1.9 1.1l-.3 2.1h-3.4l-.3-2.1a7.7 7.7 0 01-1.9-1.1l-2 .8-1.7-3 1.7-1.3a7.6 7.6 0 010-2.2L4.6 9.8l1.7-3 2 .8A7.7 7.7 0 0110.2 6.5l.3-2.1h3.4l.3 2.1c.68.26 1.31.63 1.87 1.09l2-.8 1.7 3-1.7 1.3c.07.73.07 1.47 0 2.2z',
  ellipsis: 'M6 12h.01M12 12h.01M18 12h.01',
  sidebar: 'M4.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11A1.5 1.5 0 014.5 5zM9.5 5v14',
  today: 'M4 8h16M8 3v3M16 3v3M5.5 5h13A1.5 1.5 0 0120 6.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5v-13A1.5 1.5 0 015.5 5zM12 12h4v4h-4z',
  inbox: 'M4 13h4l1.5 3h5L16 13h4M4 13l2.5-7h11L20 13v5.5A1.5 1.5 0 0118.5 20h-13A1.5 1.5 0 014 18.5z',
  location: 'M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  link: 'M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 10-5-5l-1 1M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 105 5l1-1',
  bell: 'M18 15.5V10a6 6 0 10-12 0v5.5L4.5 18h15zM10 20.5a2.2 2.2 0 004 0',
  repeat: 'M4 10.5A5.5 5.5 0 019.5 5H18M18 5l-3-3M18 5l-3 3M20 13.5A5.5 5.5 0 0114.5 19H6M6 19l3 3M6 19l3-3',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  circle: 'M12 20a8 8 0 100-16 8 8 0 000 16z',
  text: 'M5 6h14M5 12h14M5 18h9',
  checklist: 'M4 6.5l1.8 1.8L9 5M4 17.5l1.8 1.8L9 14M12 7h8M12 18h8',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
}

export type IconName = keyof typeof paths

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.7,
  filled = false,
  className,
}: {
  name: IconName | string
  size?: number
  strokeWidth?: number
  filled?: boolean
  className?: string
}) {
  const d = paths[name] ?? paths.circle
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
