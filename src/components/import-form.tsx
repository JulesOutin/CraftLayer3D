"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { importCatalog, type ImportReport, type ImportRow } from "@/app/admin/actions";

export function ImportForm() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();

  function onFile(file: File) {
    setReport(null);
    setParseError(null);
    setFileName(file.name);
    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (res.errors.length) {
          const e = res.errors[0];
          setParseError(`Fichier illisible ligne ${(e.row ?? 0) + 2} : ${e.message}`);
          setRows(null);
        } else {
          setRows(res.data);
        }
      },
    });
  }

  const slugs = rows ? new Set(rows.map((r) => r.slug)).size : 0;

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-sheet p-8 text-center hover:border-filament">
        <span className="font-medium">{fileName || "Choisir un fichier CSV"}</span>
        <span className="text-sm text-muted">Encodage UTF-8</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {parseError && <p role="alert" className="text-danger">{parseError}</p>}

      {rows && (
        <div className="space-y-4 rounded-xl bg-sheet p-5">
          <p className="tabular">
            {rows.length} lignes lues, soit {slugs} produits. Aperçu :
          </p>
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-muted">
                <tr>{["slug", "sku", "declinaison", "matiere", "grammes", "minutes_impression", "stock"].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {["slug", "sku", "declinaison", "matiere", "grammes", "minutes_impression", "stock"].map((h) => <td key={h} className="p-2">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn"
            disabled={pending}
            onClick={() => start(async () => setReport(await importCatalog(rows)))}
          >
            {pending ? "Import en cours…" : `Importer ${rows.length} lignes`}
          </button>
        </div>
      )}

      {report && (
        <div role="status" className="rounded-xl bg-sheet p-5">
          {report.errors.length === 0 ? (
            <p className="tabular text-ok">
              Import terminé : {report.products} produits et {report.variants} déclinaisons créés ou mis à jour.
            </p>
          ) : (
            <>
              <p className="font-medium text-danger">
                Rien n&apos;a été importé. Corrigez {report.errors.length > 1 ? "ces lignes" : "cette ligne"} puis relancez :
              </p>
              <ul className="tabular mt-3 max-h-80 space-y-1 overflow-y-auto text-sm">
                {report.errors.map((e, i) => (
                  <li key={i}>
                    {e.line > 0 && <span className="font-semibold">Ligne {e.line} : </span>}
                    {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
