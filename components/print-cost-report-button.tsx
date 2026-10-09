"use client";

import { Printer } from "lucide-react";

export default function PrintCostReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ef-button-primary no-print inline-flex items-center gap-2"
    >
      <Printer className="h-4 w-4" />
      Stampa rendiconto
    </button>
  );
}
