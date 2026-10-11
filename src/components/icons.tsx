// Phosphor Icons (MIT, see THIRD_PARTY_NOTICES.md), the icon set Royer UI
// uses, inlined so CSS colours them through currentColor.
function PhosphorIcon({ size, d }: { size: number; d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width={size} height={size}>
      <path fill="currentColor" d={d} />
    </svg>
  );
}

/** Phosphor "x", regular weight. */
export function CrossIcon() {
  return (
    <PhosphorIcon
      size={18}
      d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
    />
  );
}

/** Phosphor "moon", fill weight. */
export function MoonIcon() {
  return (
    <PhosphorIcon
      size={26}
      d="M235.54,150.21a104.84,104.84,0,0,1-37,52.91A104,104,0,0,1,32,120,103.09,103.09,0,0,1,52.88,57.48a104.84,104.84,0,0,1,52.91-37,8,8,0,0,1,10,10,88.08,88.08,0,0,0,109.8,109.8,8,8,0,0,1,10,10Z"
    />
  );
}

/** Phosphor "sun", fill weight. */
export function SunIcon() {
  return (
    <PhosphorIcon
      size={26}
      d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm8,24a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"
    />
  );
}

export function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "up" ? "M3 10l5-5 5 5" : "M3 6l5 5 5-5"}
      />
    </svg>
  );
}
