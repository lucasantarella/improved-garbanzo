"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useWorkflowStore } from "@/store/workflowStore";
import { validateImport } from "@/utils/validation";
import type { ExportPayload } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilenameSegment(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function buildFilename(template: { client: string; name: string; version: string }): string {
  const client = sanitizeFilenameSegment(template.client);
  const name = sanitizeFilenameSegment(template.name);
  const version = sanitizeFilenameSegment(template.version);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${client}_${name}_v${version}_${yyyy}${mm}${dd}.json`;
}

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, 100);
}

// ---------------------------------------------------------------------------
// Shared import logic
// ---------------------------------------------------------------------------

interface ImportState {
  errors: string[];
  showErrorModal: boolean;
}

function useImportLogic() {
  const [importState, setImportState] = useState<ImportState>({
    errors: [],
    showErrorModal: false,
  });

  const importTemplate = useWorkflowStore((s) => s.importTemplate);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const setDirty = useWorkflowStore((s) => s.setDirty);

  const closeErrorModal = useCallback(() => {
    setImportState({ errors: [], showErrorModal: false });
  }, []);

  const processFile = useCallback(
    (file: File) => {
      if (isDirty) {
        const confirmed = window.confirm(
          "You have unsaved changes. Import will replace all data."
        );
        if (!confirmed) return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") return;

        const result = validateImport(text);

        if (!result.valid) {
          setImportState({ errors: result.errors, showErrorModal: true });
          return;
        }

        const payload: ExportPayload = JSON.parse(text);
        importTemplate(payload.workflowTemplate);
        setDirty(false);
      };
      reader.readAsText(file);
    },
    [isDirty, importTemplate, setDirty]
  );

  return { importState, closeErrorModal, processFile };
}

// ---------------------------------------------------------------------------
// ExportButton
// ---------------------------------------------------------------------------

export function ExportButton() {
  const exportTemplate = useWorkflowStore((s) => s.exportTemplate);
  const template = useWorkflowStore((s) => s.template);
  const setDirty = useWorkflowStore((s) => s.setDirty);

  const handleExport = useCallback(() => {
    const payload = exportTemplate();
    const json = JSON.stringify(payload, null, 2);
    const filename = buildFilename(template);
    downloadJson(json, filename);
    setDirty(false);
  }, [exportTemplate, template, setDirty]);

  return (
    <Button variant="secondary" icon={Download} onClick={handleExport}>
      Export
    </Button>
  );
}

// ---------------------------------------------------------------------------
// ImportButton
// ---------------------------------------------------------------------------

export function ImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importState, closeErrorModal, processFile } = useImportLogic();

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFile]
  );

  return (
    <>
      <Button variant="secondary" icon={Upload} onClick={handleClick}>
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      {importState.showErrorModal && (
        <Modal title="Import Validation Errors" onClose={closeErrorModal}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 max-h-80 overflow-y-auto">
            {importState.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={closeErrorModal}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DragDropOverlay
// ---------------------------------------------------------------------------

export function DragDropOverlay() {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const { importState, closeErrorModal, processFile } = useImportLogic();

  useEffect(() => {
    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragOver(true);
      }
    }

    function handleDragLeave(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragOver(false);
      }
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const file = e.dataTransfer?.files[0];
      if (file && file.name.endsWith(".json")) {
        processFile(file);
      }
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [processFile]);

  return (
    <>
      {isDragOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-500/20 backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl border-4 border-dashed border-blue-500 bg-white/90 px-12 py-10 shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <Upload size={48} className="text-blue-500" />
              <p className="text-lg font-semibold text-blue-700">
                Drop JSON file to import
              </p>
            </div>
          </div>
        </div>
      )}
      {importState.showErrorModal && (
        <Modal title="Import Validation Errors" onClose={closeErrorModal}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 max-h-80 overflow-y-auto">
            {importState.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={closeErrorModal}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
