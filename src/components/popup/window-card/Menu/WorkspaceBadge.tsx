type Props = {
  color?: string;
  emoji?: string;
};

export default function WorkspaceBadge({
  emoji,
}: Props) {
  if (!emoji) {
    return null;
  }

  return (
    <div
      className="
        absolute
        left-4
        top-12
        flex
        items-center
        justify-center
        text-xl
        leading-none
        pointer-events-none
      "
    >
      {emoji}
    </div>
  );
}