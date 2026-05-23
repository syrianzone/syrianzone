"use client";
/* ================= SORTABLE ITEM ================= */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * SortableItem Component
 * Makes an item draggable & sortable using dnd-kit
 */
export default function SortableItem({
  id,
  title,
}: {
  id: string;      // Unique ID used by dnd-kit to track the item
  title: string;   // Text displayed inside the item
}) {

  // useSortable hook
  // Turns this component into a draggable/sortable element
  const {
    setNodeRef,    
    attributes,    
    listeners,     
    transform,     
    transition,   
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}      // Connects DOM node to dnd-kit
      {...attributes}     
      {...listeners}       
      style={{
        // Converts transform object to valid CSS transform
        transform: CSS.Transform.toString(transform),

        // Animation when item moves
        transition,

        // Fixed colors (important for html2canvas capture)
        color: "#ffff",
        backgroundColor: "#151c1b",
        borderColor: "#151c1b",

        // Prevents browser touch gestures (important on mobile)
        touchAction: "none",
      }}
      className="
        px-3 h-10
        rounded-md
        bg-primary/10
        text-primary
        flex items-center justify-center
        cursor-pointer
        select-none
        shadow-sm
      "
    >
      {/* Item label */}
      {title}
    </div>
  );
}
