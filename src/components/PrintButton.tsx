"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button className="btn btn-primary" type="button" onClick={() => window.print()}>
      <Printer size={17} />
      Print
    </button>
  );
}
