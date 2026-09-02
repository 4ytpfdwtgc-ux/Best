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

  /* Symbols a list can wear, drawn to the same rules as the rest. */
  clipboard:
    'M9 4.5h6a.5.5 0 01.5.5v1.6a.5.5 0 01-.5.5H9a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5z' +
    'M8.5 6H6.5a1 1 0 00-1 1v12.5a1 1 0 001 1h11a1 1 0 001-1V7a1 1 0 00-1-1h-2',
  briefcase:
    'M4.5 8.5h15a1 1 0 011 1v8a1 1 0 01-1 1h-15a1 1 0 01-1-1v-8a1 1 0 011-1z' +
    'M9 8.5v-2a1 1 0 011-1h4a1 1 0 011 1v2',
  home: 'M4 10.5L12 4.2l8 6.3V19a1 1 0 01-1 1H5a1 1 0 01-1-1zM9.8 20v-5h4.4v5',
  cart:
    'M3 5.5h2.3l2.5 9.5h9.3l2-6.5H6.3' +
    'M9.6 19a1.3 1.3 0 11-2.6 0 1.3 1.3 0 012.6 0M18 19a1.3 1.3 0 11-2.6 0 1.3 1.3 0 012.6 0',
  target:
    'M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17M12 15.8a3.8 3.8 0 100-7.6 3.8 3.8 0 000 7.6M12 12h.01',
  plane: 'M21 3.5L3.5 11l7 3 3 7zM10.5 14L21 3.5',
  book: 'M12 6.6S10 4.9 4.5 4.9v12.6c5.5 0 7.5 1.6 7.5 1.6s2-1.6 7.5-1.6V4.9C14 4.9 12 6.6 12 6.6zM12 6.6v13.5',
  bulb:
    'M9.5 17.5h5M10.3 20.5h3.4' +
    'M12 3.5a5.8 5.8 0 013.4 10.5c-.6.4-.9 1-.9 1.7h-5c0-.7-.3-1.3-.9-1.7A5.8 5.8 0 0112 3.5z',
  dumbbell: 'M4 9.5v5M7 7v10M17 7v10M20 9.5v5M7 12h10',
  gift:
    'M3.5 8.5h17v3.5h-17zM5 12h14v7a1 1 0 01-1 1H6a1 1 0 01-1-1zM12 8.5V20' +
    'M9 8.5a2 2 0 113-2.6 2 2 0 113 2.6',
  heart:
    'M12 19.8l-1.2-1.1C6.3 14.6 3.5 12 3.5 8.9A4.4 4.4 0 018 4.5c1.6 0 3.1.7 4 2' +
    ' .9-1.3 2.4-2 4-2a4.4 4.4 0 014.5 4.4c0 3.1-2.8 5.7-7.3 9.8z',
  music:
    'M9.5 17.5V5.5l9.5-2v12' +
    'M9.5 17.5a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0M19 15.5a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0',

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

/**
 * Whether a stored string names an icon. A list's symbol may be an icon name
 * or, for anything saved before the set existed, an emoji — this tells the two
 * apart so both keep rendering.
 */
export function isIconName(value: string | undefined): boolean {
  return !!value && Object.prototype.hasOwnProperty.call(paths, value)
}

/** The glyphs offered as list symbols, in picker order. */
export const LIST_SYMBOLS: string[] = [
  'clipboard', 'inbox', 'briefcase', 'home', 'cart', 'target',
  'plane', 'book', 'bulb', 'dumbbell', 'gift', 'heart', 'music', 'star',
]

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
