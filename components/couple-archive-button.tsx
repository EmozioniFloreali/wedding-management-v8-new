"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";
import { setCoupleArchived } from "@/app/protected/coppie/actions";

export function CoupleArchiveButton({
  coupleId,
  archived,
}: {
  coupleId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={archived ? "outline" : "secondary"}
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setCoupleArchived(coupleId, !archived);
        })
      }
    >
      {archived ? (
        <>
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Ripristina coppia
        </>
      ) : (
        <>
          <Archive className="mr-2 h-4 w-4" />
          Archivia coppia
        </>
      )}
    </Button>
  );
}
