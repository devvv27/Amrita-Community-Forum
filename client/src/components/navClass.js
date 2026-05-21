export function navClass({ isActive }) {
  return `w-full lg:w-auto inline-flex items-center px-3 py-2 rounded-md text-sm transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/80 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian justify-start lg:justify-center ${
    isActive
      ? "bg-white/12 text-text shadow-[0_0_22px_rgba(255,255,255,0.08)] border border-white/10"
      : "text-text/85 hover:bg-white/10 hover:text-text"
  }`;
}