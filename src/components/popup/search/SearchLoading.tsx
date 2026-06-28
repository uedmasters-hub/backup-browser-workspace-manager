export default function SearchLoading() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-14 animate-pulse rounded-xl bg-neutral-100"
        />
      ))}
    </div>
  );
}