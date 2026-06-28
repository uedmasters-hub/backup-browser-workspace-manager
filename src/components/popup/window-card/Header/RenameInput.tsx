type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

export default function RenameInput({
  value,
  disabled = false,
  onChange,
  onSave,
  onCancel,
}: Props) {
  async function handleSave() {
    if (disabled) {
      return;
    }

    await onSave();
  }

  return (
    <input
      autoFocus
      value={value}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleSave}
      onKeyDown={async (e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            e.currentTarget.blur();
            break;

          case "Escape":
            e.preventDefault();
            onCancel();
            break;
        }
      }}
      className="
        w-full
        rounded-lg
        bg-white/70
        px-2
        py-1
        text-base
        font-medium
        outline-none
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    />
  );
}