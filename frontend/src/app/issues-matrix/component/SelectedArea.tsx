"use client";

/* =====================================================
   SELECTED AREA
   This component represents the temporary holding area
   for selected issues before placing them into the matrix.
===================================================== */

import { useDroppable } from "@dnd-kit/core";
import SortableItem from "./SortableItem";
import { Issue } from "@/lib/getIssues";

/**
 * SelectedArea
 * @param selected - List of issues currently selected by the user
 */
export default function SelectedArea({ selected }: { selected: Issue[] }) {
  /**
   * useDroppable
   * Makes this area a valid drop target for drag & drop
   */
  const { setNodeRef, isOver } = useDroppable({ id: "selected" });

  return (
    <div
      ref={setNodeRef} // Reference required by dnd-kit
      className={`
        flex flex-wrap gap-2 p-4 border rounded-md
        bg-card min-h-[70px] shadow-sm
        ${isOver ? "ring-2 ring-primary" : ""}
      `}
      style={{ touchAction: "none" }} // Improves mobile drag behavior
    >
      {/* Render selected issues as sortable items */}
      {selected.map((issue) => (
        <SortableItem
          key={issue.id}
          id={issue.id}
          title={issue.title}
        />
      ))}
    </div>
  );
}
