"use client";

import { useTheme } from "@/components/ThemeProvider";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className="sr-only">{isDark ? "Switch to light theme" : "Switch to dark theme"}</span>
      {isDark ? (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
          <circle cx="10" cy="10" r="3.2" />
          <path d="M10 2.5v2" />
          <path d="M10 15.5v2" />
          <path d="m4.7 4.7 1.4 1.4" />
          <path d="m13.9 13.9 1.4 1.4" />
          <path d="M2.5 10h2" />
          <path d="M15.5 10h2" />
          <path d="m4.7 15.3 1.4-1.4" />
          <path d="m13.9 6.1 1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
          <path d="M14.8 12.8A6.5 6.5 0 0 1 7.2 5.2 6.5 6.5 0 1 0 14.8 12.8Z" />
        </svg>
      )}
    </button>
  );
}
