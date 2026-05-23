/* =====================================================
   TYPES
===================================================== */

/**
 * Issue
 * Represents a single issue used in the UI and matrix.
 */
export type Issue = {
  id: string;        // Unique identifier
  title: string;     // Issue title
  category: string;  // Category name (used for filtering)
};

/**
 * SheetRow
 * Represents the raw row structure coming from Google Sheets.
 * (Same shape as Issue, but kept separate for clarity)
 */
type SheetRow = {
  id: string;
  title: string;
  category: string;
};

/* =====================================================
   DATA FETCH FUNCTION
===================================================== */

/**
 * Fetches issues from a public Google Sheets JSON endpoint
 * and converts them into Issue objects used by the app.
 */export async function getIssues(): Promise<Issue[]> {
  const url = process.env.NEXT_PUBLIC_ISSUES_SHEET_URL;

  if (!url) {
    console.error("NEXT_PUBLIC_ISSUES_SHEET_URL is not defined");
    return [];
  }

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch Google Sheet data");
    }

    const data: SheetRow[] = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid data format from Google Sheets");
    }

    return data
      .filter(
        (row) =>
          row &&
          typeof row.title === "string" &&
          typeof row.category === "string"
      )
      .map((row, index) => ({
        id: row.id?.toString() ?? String(index),
        title: row.title,
        category: row.category,
      }));
  } catch (error) {
    console.error("getIssues failed:", error);
    
    return [];
  }
}
