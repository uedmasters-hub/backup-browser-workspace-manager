import { X } from "lucide-react";

type DialogHeaderProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
};

export default function DialogHeader({
  title,
  subtitle,
  onClose,
}: DialogHeaderProps) {
  return (
    <header className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500">
            {subtitle}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="ml-4 flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <X size={18} />
      </button>
    </header>
  );
}