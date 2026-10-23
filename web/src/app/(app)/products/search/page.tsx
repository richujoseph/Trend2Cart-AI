import { Suspense } from "react";
import SearchResults from "./search-results";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
