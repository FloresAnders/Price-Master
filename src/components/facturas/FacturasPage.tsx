"use client";

import React, { useEffect, useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import {
  X,
  Lock,
  LockOpen,
  Plus,
  Edit,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { useProviders } from "../../hooks/useProviders";

type FacturaEntry = {
  id: string;
  type: "FC" | "NC";
  providerCode: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  amountThousands: number;
  receptionDate: string; // ISO date
  createdAt: string; // ISO
};

export default function FacturasCreditoPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:py-8">
      <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm sm:p-4 md:p-5"></div>
    </div>
  );
}
