import { Search } from "lucide-react";

export default function SearchEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Search
        size={42}
        className="mb-4 text-neutral-300"
      />

      <h3 className="font-semibold">
        No results
      </h3>

      <p className="mt-2 text-sm text-neutral-500">
        Try another keyword
        <br />
        or use
        {" "}
        <strong>@deep</strong>
        {" "}
        to search page content.
      </p>
    </div>
  );
}