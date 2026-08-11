"use client";

import { useState, useEffect, useRef } from "react";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, Save, X, MoreVertical, Star as StarIcon, ArrowLeft, ArrowRight, Archive, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Types
interface Candidate {
    id: string;
    candidate_group_id?: string | null;
    name: string;
    title?: string | null;
    image_url?: string | null;
    imageUrl?: string | null; // Frontend helper
    category?: string | null;
    status?: "active" | "archived";
    term_started_at?: string | null;
    term_ended_at?: string | null;
    archive_reason?: string | null;
    successor_id?: string | null;
}

interface Group {
    id: string;
    poll_id: string;
    name: string;
    key?: string | null;
    sort_order: number;
    is_default?: boolean;
}

interface PollData {
    id: string;
    candidates: Candidate[];
    groups: Group[];
}

interface Props {
    pollId: string;
    initialData: PollData;
    onRefresh: () => void;
}

export default function AdminPollManager({ pollId, initialData, onRefresh }: Props) {
    const [groups, setGroups] = useState<Group[]>(initialData.groups || []);
    const [candidates, setCandidates] = useState<Candidate[]>(initialData.candidates || []);
    const [activeTab, setActiveTab] = useState<string>("all");
    const [error, setError] = useState<string | null>(null);

    // Sync state when props change
    useEffect(() => {
        setGroups(initialData.groups || []);
        setCandidates(initialData.candidates || []);
    }, [initialData]);

    // Group Management
    const [newGroupName, setNewGroupName] = useState("");
    const [isAddingGroup, setIsAddingGroup] = useState(false);

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        setIsAddingGroup(true);
        try {
            await axios.post("/api/candidate-groups", { poll_id: pollId, name: newGroupName });
            setNewGroupName("");
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to add group");
        } finally {
            setIsAddingGroup(false);
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!confirm("Delete this group and unassign its candidates?")) return;
        try {
            await axios.delete(`/api/candidate-groups/${id}`);
            onRefresh();
            if (activeTab === id) setActiveTab("all");
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to delete group");
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            await axios.post(`/api/candidate-groups/${id}/default`);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "فشل تعيين المجموعة الافتراضية");
        }
    };

    const handleMoveGroup = async (id: string, direction: 'left' | 'right') => {
        const index = groups.findIndex(g => g.id === id);
        if (index === -1) return;

        const newGroups = [...groups];
        // RTL logic: 
        // "Right" arrow (visual Right) -> index - 1
        // "Left" arrow (visual Left) -> index + 1

        const targetIndex = direction === 'left' ? index + 1 : index - 1;

        if (targetIndex < 0 || targetIndex >= newGroups.length) return;

        // Swap
        [newGroups[index], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[index]];

        // Optimistic update
        setGroups(newGroups);

        // Send new order
        const orderPayload = newGroups.map((g, idx) => ({
            id: g.id,
            sort_order: idx
        }));

        try {
            await axios.post('/api/candidate-groups/reorder', { groups: orderPayload });
            // onRefresh(); 
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "فشل إعادة الترتيب");
            onRefresh(); // Revert
        }
    };

    // Candidate Management
    const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    // Form State
    const [cName, setCName] = useState("");
    const [cTitle, setCTitle] = useState("");
    const [cImage, setCImage] = useState("");
    // const [cCategory, setCCategory] = useState("minister"); // Removed static category
    const [cGroupId, setCGroupId] = useState<string | null>(null);

    const openAddCandidate = (groupId: string | null) => {
        setEditingCandidate(null);
        setCName("");
        setCTitle("");
        setCImage("");
        // setCCategory("minister");
        if (groupId) {
            setCGroupId(groupId);
        } else {
            setCGroupId(null);
        }
        setIsCandidateModalOpen(true);
    };

    const openEditCandidate = (c: Candidate) => {
        setEditingCandidate(c);
        setCName(c.name);
        setCTitle(c.title || "");
        setCImage(c.image_url || c.imageUrl || "");
        // setCCategory(c.category || "minister");
        setCGroupId(c.candidate_group_id || null);
        setIsCandidateModalOpen(true);
    };

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const startUpload = async (files: File[]) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", files[0]);
            formData.append("folder", "candidates");
            const res = await axios.post("/api/v1/admin/assets/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const url = res.data?.url;
            if (url) setCImage(url);
            setUploadError(null);
        } catch (err: any) {
            console.error(err);
            setUploadError(err.response?.data?.message || err.message || "Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDroppedFiles = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
            setUploadError("نوع الملف غير مدعوم — JPEG/PNG/WEBP فقط");
            return;
        }
        startUpload([file]);
    };

    const handleSaveCandidate = async () => {
        if (!cName.trim()) return;

        const payload: any = {
            name: cName,
            title: cTitle || null,
            image_url: cImage || null,
            // category: cCategory || null,
            candidate_group_id: cGroupId || null,
        };

        // If adding new
        if (!editingCandidate) {
            payload.poll_id = pollId;
            // If active tab is a specific group, assign it
            if (activeTab !== "all") {
                payload.candidate_group_id = activeTab;
            }
        }

        try {
            if (editingCandidate) {
                await axios.put(`/api/candidates/${editingCandidate.id}`, payload);
            } else {
                await axios.post("/api/candidates", payload);
            }
            setIsCandidateModalOpen(false);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to save candidate");
        }
    };

    const handleDeleteCandidate = async (id: string) => {
        if (!confirm("Are you sure you want to delete this candidate?")) return;
        try {
            await axios.delete(`/api/candidates/${id}`);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to delete candidate");
        }
    };

    // Archive / Restore
    const [archiveTarget, setArchiveTarget] = useState<Candidate | null>(null);
    const [aTermEnd, setATermEnd] = useState<string>("");
    const [aReason, setAReason] = useState<string>("");
    const [aSuccessorId, setASuccessorId] = useState<string>("none");
    const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");

    const openArchive = (c: Candidate) => {
        setArchiveTarget(c);
        setATermEnd(new Date().toISOString().slice(0, 10));
        setAReason("");
        setASuccessorId("none");
    };

    const handleSubmitArchive = async () => {
        if (!archiveTarget) return;
        try {
            await axios.patch(`/api/candidates/${archiveTarget.id}/archive`, {
                term_ended_at: aTermEnd || null,
                archive_reason: aReason || null,
                successor_id: aSuccessorId === "none" ? null : aSuccessorId,
            });
            setArchiveTarget(null);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to archive candidate");
        }
    };

    const handleRestore = async (c: Candidate) => {
        if (!confirm(`إعادة تفعيل ${c.name}؟`)) return;
        try {
            await axios.patch(`/api/candidates/${c.id}/restore`);
            onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to restore candidate");
        }
    };

    // Filter candidates for display
    const baseCandidates = activeTab === "all"
        ? candidates
        : candidates.filter(c => c.candidate_group_id === activeTab);

    const displayedCandidates = baseCandidates.filter(c => {
        if (statusFilter === "all") return true;
        const s = c.status ?? "active";
        return s === statusFilter;
    });

    // Successor candidates: same group, active, not the archive target itself
    const successorOptions = archiveTarget
        ? candidates.filter(c =>
            c.id !== archiveTarget.id &&
            (c.status ?? "active") === "active" &&
            c.candidate_group_id === archiveTarget.candidate_group_id
        )
        : [];

    return (
        <div className="space-y-6">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                        <TabsTrigger
                            value="all"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-border bg-background"
                        >
                            All Candidates ({candidates.length})
                        </TabsTrigger>
                        {groups.map(g => (
                            <TabsTrigger
                                key={g.id}
                                value={g.id}
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-border bg-background"
                            >
                                {g.name} ({candidates.filter(c => c.candidate_group_id === g.id).length})
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Input
                                placeholder="New Group Name"
                                className="w-40 h-8 text-sm"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                            />
                        </div>
                        <Button size="sm" variant="outline" onClick={handleAddGroup} disabled={isAddingGroup}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="mb-4 flex justify-between items-center bg-muted/40 p-2 rounded-md">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                            {activeTab === "all" ? "جميع المرشحين" : groups.find(g => g.id === activeTab)?.name}
                        </h3>
                        {activeTab !== "all" && (
                            <div className="flex items-center gap-1 mr-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleSetDefault(activeTab)}
                                    title="تعيين كمجموعة افتراضية"
                                >
                                    <StarIcon
                                        className={`h-4 w-4 ${groups.find(g => g.id === activeTab)?.is_default ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                                    />
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleMoveGroup(activeTab, 'left')}
                                    title="تحريك لليمين"
                                    disabled={groups.findIndex(g => g.id === activeTab) === groups.length - 1}
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleMoveGroup(activeTab, 'right')}
                                    title="تحريك لليسار"
                                    disabled={groups.findIndex(g => g.id === activeTab) === 0}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive h-8 w-8 p-0"
                                    onClick={() => handleDeleteGroup(activeTab)}
                                    title="حذف المجموعة"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
                            {(["active", "archived", "all"] as const).map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setStatusFilter(opt)}
                                    className={`px-2 py-1 rounded-sm transition-colors ${
                                        statusFilter === opt ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                    }`}
                                >
                                    {opt === "active" ? "الحاليون" : opt === "archived" ? "السابقون" : "الكل"}
                                </button>
                            ))}
                        </div>
                        <Button onClick={() => openAddCandidate(activeTab === "all" ? null : activeTab)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Candidate
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedCandidates.map(candidate => {
                        const isArchived = (candidate.status ?? "active") === "archived";
                        const successorName = candidate.successor_id
                            ? candidates.find(c => c.id === candidate.successor_id)?.name
                            : null;
                        return (
                            <Card key={candidate.id} className={`overflow-hidden ${isArchived ? "opacity-75 border-dashed" : ""}`}>
                                <CardContent className="p-4 flex gap-3 items-start">
                                    <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                        {(candidate.image_url || candidate.imageUrl) ? (
                                            <img src={candidate.image_url || candidate.imageUrl || ""} alt={candidate.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-xs text-gray-500">Img</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold truncate" title={candidate.name}>{candidate.name}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{candidate.title}</p>
                                        <div className="flex mt-1 gap-1 flex-wrap">
                                            {activeTab === "all" && candidate.candidate_group_id && (
                                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full">
                                                    {groups.find(g => g.id === candidate.candidate_group_id)?.name || "Unknown Group"}
                                                </span>
                                            )}
                                            {isArchived && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">سابق</Badge>
                                            )}
                                        </div>
                                        {isArchived && (
                                            <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                                                {candidate.term_ended_at && <div>حتى {candidate.term_ended_at}</div>}
                                                {candidate.archive_reason && <div>السبب: {candidate.archive_reason}</div>}
                                                {successorName && <div>خلفه: {successorName}</div>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditCandidate(candidate)} title="تعديل">
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        {isArchived ? (
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRestore(candidate)} title="إعادة تفعيل">
                                                <Undo2 className="h-3 w-3" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openArchive(candidate)} title="أرشفة">
                                                <Archive className="h-3 w-3" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteCandidate(candidate.id)} title="حذف">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {displayedCandidates.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                            No candidates found in this group.
                        </div>
                    )}
                </div>
            </Tabs>

            {/* Edit/Add Modal */}
            <Dialog open={isCandidateModalOpen} onOpenChange={setIsCandidateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCandidate ? "Edit Candidate" : "Add Candidate"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="c-name" className="text-right">Name</Label>
                            <Input id="c-name" value={cName} onChange={e => setCName(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="c-title" className="text-right">Title</Label>
                            <Input id="c-title" value={cTitle} onChange={e => setCTitle(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">Image</Label>
                            <div className="col-span-3 space-y-2">
                                <div
                                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDragging(false);
                                        if (!isUploading) handleDroppedFiles(e.dataTransfer.files);
                                    }}
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                    className={`flex items-center gap-3 rounded-md border-2 border-dashed p-3 cursor-pointer transition-colors ${
                                        isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                                    } ${isUploading ? "opacity-60 cursor-wait" : ""}`}
                                >
                                    <div className="h-16 w-16 rounded-md bg-muted overflow-hidden flex-shrink-0 border">
                                        {cImage ? (
                                            <img src={cImage} alt="preview" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No image</span>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) startUpload([file]);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                    />
                                    <div className="flex-1 text-xs text-muted-foreground">
                                        {isUploading ? "جاري الرفع..." : (
                                            <>
                                                {isDragging ? "أفلت الصورة هنا" : "اسحب صورة هنا أو اضغط للاختيار"}
                                                <div className="text-[10px] opacity-70 mt-0.5">JPEG / PNG / WEBP — حتى 4MB</div>
                                            </>
                                        )}
                                    </div>
                                    {cImage && !isUploading && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); setCImage(""); }}
                                        >
                                            مسح
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    id="c-image"
                                    value={cImage}
                                    onChange={e => setCImage(e.target.value)}
                                    placeholder="أو الصق رابطًا مباشرًا"
                                    className="text-left text-xs"
                                    dir="ltr"
                                />
                                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="c-group" className="text-right">Group</Label>
                            <Select value={cGroupId || "none"} onValueChange={(val) => setCGroupId(val === "none" ? null : val)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select Group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Group</SelectItem>
                                    {groups.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCandidateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveCandidate}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Archive Modal */}
            <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>أرشفة المرشح</DialogTitle>
                        <DialogDescription>
                            {archiveTarget?.name} — سيُحفظ سجله ويُستثنى من التصويت والترتيب الحالي.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="a-end" className="text-right">تاريخ الانتهاء</Label>
                            <Input
                                id="a-end"
                                type="date"
                                value={aTermEnd}
                                onChange={e => setATermEnd(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="a-reason" className="text-right pt-2">السبب</Label>
                            <Textarea
                                id="a-reason"
                                value={aReason}
                                onChange={e => setAReason(e.target.value)}
                                placeholder="استقال، تمت إقالته، انتهت ولايته..."
                                className="col-span-3"
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="a-successor" className="text-right">الخليفة</Label>
                            <Select value={aSuccessorId} onValueChange={setASuccessorId}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="اختر الخليفة (اختياري)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">لا يوجد</SelectItem>
                                    {successorOptions.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setArchiveTarget(null)}>إلغاء</Button>
                        <Button onClick={handleSubmitArchive}>أرشفة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
