"use client";

/* ================= IMPORTS ================= */
import { useMemo, useState, useRef, useEffect } from "react";

/* UI Components */
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* Icons */
import { X, Download, Share2 } from "lucide-react";

/* Utils */
import html2canvas from "html2canvas";

/* Data */
import { getIssues, Issue } from "@/lib/getIssues";

/* Custom Components */
import MatrixColumn from "./component/MatrixColumn";
import SelectedArea from "./component/SelectedArea";

/* Drag & Drop */
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

/* ================= MAIN COMPONENT ================= */

export default function IssuesMatrixClient() {
  /* ---------- CONSTANTS ---------- */
  const PAGE_SIZE = 12;

  const MATRIX_CATEGORIES = [
    { id: "important-urgent", title: "هام وعاجل" },
    { id: "important-not-urgent", title: "هام وغير عاجل" },
    { id: "not-important-urgent", title: "غير هام وعاجل" },
    { id: "not-important-not-urgent", title: "غير هام وغير عاجل" },
  ];

  /* ---------- STATE ---------- */
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState<Issue[]>([]);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  const [matrix, setMatrix] = useState<Record<string, Issue[]>>({
    "important-urgent": [],
    "important-not-urgent": [],
    "not-important-urgent": [],
    "not-important-not-urgent": [],
  });

  const matrixRef = useRef<HTMLDivElement | null>(null);

  /* ---------- DATA FETCH ---------- */
 useEffect(() => {
  const loadIssues = async () => {
    try {
      const data = await getIssues();
      setIssues(data);
    } catch (err) {
      console.error("Failed to load issues", err);
      setIssues([]);
    }
  };

  loadIssues();
}, []);

  /* ---------- RESPONSIVE ---------- */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  /* ---------- FILTERING ---------- */
  const categories = useMemo(
    () => Array.from(new Set(issues.map((i) => i.category))),
    [issues]
  );

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchSearch =
        !search ||
        issue.title.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        category === "all" || issue.category === category;

      return matchSearch && matchCategory;
    });
  }, [issues, search, category]);

  const visibleIssues = useMemo(
    () => filteredIssues.slice(0, visibleCount),
    [filteredIssues, visibleCount]
  );

  /* ---------- DRAG & DROP ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const findContainerOfItem = (itemId: string): string | null => {
    if (selected.some((i) => i.id === itemId)) return "selected";

    for (const key in matrix) {
      if (matrix[key].some((i) => i.id === itemId)) return key;
    }

    return null;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;

    const activeId = active.id as string;
    let overId = over.id as string;

    const source = findContainerOfItem(activeId);
    if (!source) return;

    const overContainer = findContainerOfItem(overId);
    if (overContainer) overId = overContainer;

    const target =
      overId === "selected" || matrix[overId] ? overId : null;

    if (!target || source === target) return;

    let movedItem: Issue | undefined;

    if (source === "selected") {
      movedItem = selected.find((i) => i.id === activeId);
      setSelected((prev) => prev.filter((i) => i.id !== activeId));
    } else {
      movedItem = matrix[source].find((i) => i.id === activeId);
      setMatrix((prev) => ({
        ...prev,
        [source]: prev[source].filter((i) => i.id !== activeId),
      }));
    }

    if (!movedItem) return;

    if (target === "selected") {
      setSelected((prev) => [...prev, movedItem]);
    } else {
      setMatrix((prev) => ({
        ...prev,
        [target]: [...prev[target], movedItem],
      }));
    }
  };

  /* ---------- DOWNLOAD ---------- */
  const handleDownload = async () => {
    if (!matrixRef.current) return;

    const canvas = await html2canvas(matrixRef.current, {
      backgroundColor: "#151c1b",
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
    });

    const link = document.createElement("a");
    link.download = `ترتيب-القضايا-${new Date().toISOString().split("T")[0]}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  /* ---------- SHARE ---------- */
  const handleShare = async () => {
    if (!matrixRef.current) return;

    const canvas = await html2canvas(matrixRef.current, {
      backgroundColor: "#151c1b",
      scale: 2,
      useCORS: true,
    });

    canvas.toBlob((blob) => {
      if (!blob || !navigator.share) return;

      navigator.share({
        files: [new File([blob], "matrix.png", { type: "image/png" })],
        title: "مصفوفة أيزنهاور",
      });
    });
  };
return (
  /* Root container (RTL layout + full height) */
  <div className="bg-background min-h-screen" dir="rtl">
    {/* ================= HEADER ================= */}
    <section className="bg-card py-6 border-b sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
        <h1 className="text-3xl font-bold">
          ترتيب القضايا حسب مصفوفة أيزنهاور
        </h1>

        <div className="flex flex-col md:flex-row gap-3 max-w-3xl mx-auto items-center">
          {/* Search input */}
          <div className="relative w-full md:flex-1">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="ابحث عن قضية..."
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="w-full md:w-[180px]">
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    {/* ================= MAIN CONTENT ================= */}
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {visibleIssues.map((issue) => {
          const active = selected.some((i) => i.id === issue.id);

          return (
            <Card
              key={issue.id}
              onClick={() => {
                const isInMatrix = Object.values(matrix).some((arr) =>
                  arr.some((i) => i.id === issue.id)
                );
                if (isInMatrix) return;

                if (isMobile) {
                  setActiveIssue(issue);
                  return;
                }

                const isSelected = selected.some(
                  (i) => i.id === issue.id
                );

                setSelected((prev) =>
                  isSelected
                    ? prev.filter((i) => i.id !== issue.id)
                    : [...prev, issue]
                );
              }}
              className={`cursor-pointer transition ${
                active ? "ring-2 ring-primary" : "hover:shadow-md"
              }`}
            >
              <CardContent className="p-4 text-center">
                <div className="font-medium">{issue.title}</div>
                <div className="text-sm opacity-60">
                  {issue.category}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleCount < filteredIssues.length && (
        <div className="text-center mt-4 mb-4">
          <Button
            variant="outline"
            onClick={() =>
              setVisibleCount((v) => v + PAGE_SIZE)
            }
          >
            تحميل المزيد
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={selected.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          <SelectedArea selected={selected} />
        </SortableContext>

        <div
          ref={matrixRef}
          data-chart-container
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
          style={{ touchAction: "none" }}
        >
          {MATRIX_CATEGORIES.map((cat) => (
            <MatrixColumn
              key={cat.id}
              id={cat.id}
              title={cat.title}
              items={matrix[cat.id]}
            />
          ))}
        </div>
      </DndContext>

      <div className="flex gap-2 justify-end mt-6">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 ml-1" />
          تحميل
        </Button>

        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="w-4 h-4 ml-1" />
          مشاركة
        </Button>
      </div>
    </main>

    {activeIssue && isMobile && (
      <div className="fixed inset-0 z-50 bg-black/40">
        <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl p-4">
          <div className="text-center font-bold mb-3">
            {activeIssue.title}
          </div>

          <div className="space-y-2">
            {MATRIX_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                className="w-full"
                onClick={() => {
                  setMatrix((prev) => ({
                    ...prev,
                    [cat.id]: [...prev[cat.id], activeIssue],
                  }));
                  setActiveIssue(null);
                }}
              >
                {cat.title}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            className="w-full mt-3"
            onClick={() => setActiveIssue(null)}
          >
            إلغاء
          </Button>
        </div>
      </div>
    )}
  </div>
);
}
