import { Plug } from "lucide-react";

export default function Connections() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start gap-4 mb-8">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
          <Plug className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Google Drive, Notion, Airtable, and URLs as live data sources.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Connectors ship in the next release. Configure OAuth env vars in <code>.env</code> to prepare.
        </p>
      </div>
    </div>
  );
}
