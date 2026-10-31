import { X } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

type Icon = ComponentType<{ className?: string }>;

export function InspectorHeader({
  icon: HeaderIcon,
  title,
  subtitle,
  onClose,
}: {
  icon: Icon;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-zinc-700/60 pb-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 sm:size-7">
          <HeaderIcon className="size-4 text-zinc-300" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base leading-tight font-semibold text-zinc-100 sm:text-sm">
            {title}
          </span>
          {subtitle && (
            <span className="font-mono text-[11px] leading-tight text-zinc-400 sm:text-[10px]">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      {/* 44 px hit area on touch; the negative margin keeps the visual corner tight. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-700 sm:-mt-1 sm:-mr-1 sm:size-7"
      >
        <X className="size-4 sm:size-3.5" />
      </button>
    </div>
  );
}

/** Label/value rows; two columns once the container is wide enough (the phone sheet). */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-x-6 gap-y-2 pt-2 @xs:grid-cols-2 sm:gap-y-1.5">{children}</div>
    </div>
  );
}

export function Field({
  icon: FieldIcon,
  label,
  value,
  accent,
}: {
  icon: Icon;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <FieldIcon className={`size-3.5 shrink-0 ${accent ?? 'text-zinc-500'}`} />
      <span className="text-xs text-zinc-400 sm:text-[11px]">{label}</span>
      <span className="ml-auto truncate font-mono text-sm text-zinc-100 tabular-nums sm:text-xs sm:text-zinc-200">
        {value}
      </span>
    </div>
  );
}
