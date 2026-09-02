/**
 * Inline stroke icons.
 *
 * Every glyph is drawn on the same 24x24 grid inside a 20x20 live area, from
 * as few strokes as the meaning allows, with no detail finer than about 2
 * units. They are rendered between 9 and 23 pixels, so anything more intricate
 * would turn to mush at the sizes that actually get used.
 */

const paths: Record<string, string> = {
  /* Marks and arrows */
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevronLeft: 'M14.5 5.5L8 12l6.5 6.5',
  chevronRight: 'M9.5 5.5L16 12l-6.5 6.5',
  chevronDown: 'M5.5 9.5L12 16l6.5-6.5',
  arrowRight: 'M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5',
  ellipsis: 'M6 12h.01M12 12h.01M18 12h.01',

  /* Objects */
  search: 'M10.5 17.5a7 7 0 100-14 7 7 0 000 14zM20 20l-4.1-4.1',
  flag: 'M6 20.5v-16M6 5h12l-3 4 3 4H6',
  clock: 'M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM12 7.5V12l3.2 1.9',
  calendar: 'M4 9h16M8 3.5v3M16 3.5v3M5 5.5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1v-12a1 1 0 011-1z',
  today: 'M4 9h16M8 3.5v3M16 3.5v3M5 5.5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1v-12a1 1 0 011-1zM12 14h.01',
  note: 'M6 4.5a1 1 0 011-1h6.5L18.5 8.5v11a1 1 0 01-1 1H7a1 1 0 01-1-1zM13.5 3.5v5h5',
  folder: 'M4 7.5a1 1 0 011-1h4l2 2h8a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1z',
  tag: 'M4 4.5h7L20.5 14l-6.5 6.5L4.5 11zM8 8.2h.01',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l.9 12.5h8.2L17 7',
  info: 'M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM12 11.5v5M12 7.8h.01',
  pin: 'M9.5 3.5h5l-.7 6 3.2 3v.8H7v-.8l3.2-3zM12 13.3v7.2',
  star: 'M12 4l2.5 5.2 5.6.8-4.05 4 .95 5.6-5-2.7-5 2.7.95-5.6L3.9 10l5.6-.8z',
  inbox: 'M4 13.5h4.5l1.2 2.5h4.6l1.2-2.5H20M4 13.5L6.5 6h11L20 13.5v5a1 1 0 01-1 1H5a1 1 0 01-1-1z',
  location: 'M12 20.5c4-4.2 6-7.4 6-9.9a6 6 0 10-12 0c0 2.5 2 5.7 6 9.9zM12 13.2a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2z',
  link: 'M10.2 13.8a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1M13.8 10.2a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1',
  bell: 'M17.5 16V10a5.5 5.5 0 10-11 0v6l-1.5 2.5h14zM10.2 21a2 2 0 003.6 0',
  repeat: 'M4.5 11.5A6.5 6.5 0 0111 5h8.5M16.5 2l3 3-3 3M19.5 12.5A6.5 6.5 0 0113 19H4.5M7.5 22l-3-3 3-3',
  sun: 'M12 16.6a4.6 4.6 0 100-9.2 4.6 4.6 0 000 9.2M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7',
  moon: 'M20 14.6A8.6 8.6 0 019.4 4 8.6 8.6 0 1020 14.6z',
  circle: 'M12 20a8 8 0 100-16 8 8 0 000 16z',

  /* Layout and lists */
  sidebar: 'M4.5 5.5h15a1 1 0 011 1v11a1 1 0 01-1 1h-15a1 1 0 01-1-1v-11a1 1 0 011-1zM9.5 5.5v13',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.8 6.5h.01M4.8 12h.01M4.8 17.5h.01',
  text: 'M5 6.5h14M5 12h14M5 17.5h9',
  checklist: 'M4.5 7l1.7 1.7 3.3-3.3M4.5 17l1.7 1.7 3.3-3.3M12.5 7.5h7M12.5 17.5h7',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',

  /*
   * Settings is two sliders rather than a cog. A cog simplified far enough to
   * survive 13px becomes a ring with radial ticks, which is the sun icon; this
   * stays legible and cannot be confused with anything else in the set.
   */
  gear:
    'M4 8.5h16M4 15.5h16' +
    'M17.4 8.5a2.4 2.4 0 10-4.8 0 2.4 2.4 0 004.8 0' +
    'M11.4 15.5a2.4 2.4 0 10-4.8 0 2.4 2.4 0 004.8 0',
}

export type IconName = keyof typeof paths

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.5,
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
