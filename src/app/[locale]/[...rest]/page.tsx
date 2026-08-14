import { notFound } from "next/navigation";

// Catch-all inside the locale segment so unmatched in-locale URLs render the
// styled not-found page instead of falling through to the bare default.
export default function CatchAllPage() {
  notFound();
}
