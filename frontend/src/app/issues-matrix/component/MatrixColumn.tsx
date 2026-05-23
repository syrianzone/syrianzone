"use client";
/* ================= MATRIX COLUMN ================= */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Issue } from "@/lib/getIssues";
import SortableItem from "./SortableItem";

/**
 * MatrixColumn Component
 * Represents a single Eisenhower matrix quadrant
 * Acts as a droppable area and contains sortable items
 */
export default function MatrixColumn({
  id,
  title,
  items,
}: {
  id: string;        // Column ID (used as droppable container id)
  title: string;     // Column title displayed at the top
  items: Issue[];    // Issues currently inside this column
}) {

  // useDroppable hook
  // Makes this column a valid drop target
  const {
    setNodeRef,  // Ref attached to droppable container
    isOver,      // True when a draggable item is hovering over this column
  } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}   // Connects column to dnd-kit
      className={`
        p-4 border rounded-md bg-card
        min-h-[200px]
        transition shadow-sm
        ${isOver ? "ring-2 ring-primary" : ""}
      `}
      style={{
        // Prevents touch scrolling conflicts on mobile
        touchAction: "none",
      }}
    >
      {/* Column title */}
      <h2 className="text-center font-semibold mb-3">
        {title}
      </h2>

      {/* Sortable list inside this column */}
      <SortableContext
        items={items.map((i) => i.id)}   // IDs of sortable items
        strategy={verticalListSortingStrategy} // Vertical sorting behavior
      >
        <div className="flex flex-col gap-2">
          {items.map((issue) => (
            <SortableItem
              key={issue.id}      
              id={issue.id}       
              title={issue.title} 
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
