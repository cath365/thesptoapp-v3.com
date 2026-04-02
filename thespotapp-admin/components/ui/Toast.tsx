"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#fff",
          color: "#1f2937",
          boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          borderRadius: "0.75rem",
          padding: "0.75rem 1rem",
          fontSize: "0.875rem",
        },
        success: {
          iconTheme: {
            primary: "#4CAF50",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#FF5252",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
