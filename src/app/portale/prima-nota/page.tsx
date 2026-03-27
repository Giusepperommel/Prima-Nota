"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrimaNotaContent } from "./prima-nota-content";
import { ArrowLeft } from "lucide-react";

export default function PortalePrimaNotaPage() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("portale_token");
    localStorage.removeItem("portale_nome");
    localStorage.removeItem("portale_ruolo");
    router.push("/portale/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portale"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="h-4 w-px bg-gray-300" />
            <h1 className="text-lg font-bold text-gray-900">Prima Nota</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <PrimaNotaContent />
      </main>
    </div>
  );
}
