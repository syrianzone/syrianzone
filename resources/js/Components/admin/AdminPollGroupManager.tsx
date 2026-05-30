"use client";

import { useState } from "react";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Group {
    id: string;
    poll_id: string;
    name: string;
    key?: string | null;
    sort_order: number;
}

interface Props {
    pollId: string;
    initialGroups: Group[];
    onGroupsChange?: () => void;
}

export default function AdminPollGroupManager({
    pollId,
    initialGroups,
    onGroupsChange,
}: Props) {
    const [groups, setGroups] = useState<Group[]>(initialGroups);
    const [newGroupName, setNewGroupName] = useState("");
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newGroupName.trim()) return;
        setAdding(true);
        setError(null);
        try {
            const res = await axios.post("/candidate-groups", {
                poll_id: pollId,
                name: newGroupName,
            });
            setGroups([...groups, res.data]);
            setNewGroupName("");
            if (onGroupsChange) onGroupsChange();
        } catch (err: any) {
            console.error(err);
            setError("Failed to add group");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Candidates in this group will be unassigned.")) return;
        try {
            await axios.delete(`/candidate-groups/${id}`);
            setGroups(groups.filter((g) => g.id !== id));
            if (onGroupsChange) onGroupsChange();
        } catch (err: any) {
            console.error(err);
            setError("Failed to delete group");
        }
    };

    const startEdit = (group: Group) => {
        setEditingId(group.id);
        setEditName(group.name);
    };

    const saveEdit = async (id: string) => {
        if (!editName.trim()) return;
        try {
            const res = await axios.put(`/candidate-groups/${id}`, {
                name: editName,
            });
            setGroups(groups.map((g) => (g.id === id ? res.data : g)));
            setEditingId(null);
            if (onGroupsChange) onGroupsChange();
        } catch (err: any) {
            console.error(err);
            setError("Failed to update group");
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="flex gap-2 items-end">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="new-group">New Group Name</Label>
                    <Input
                        type="text"
                        id="new-group"
                        placeholder="e.g. Government"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                </div>
                <Button onClick={handleAdd} disabled={adding || !newGroupName.trim()}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    No groups found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            groups
                                .sort((a, b) => a.sort_order - b.sort_order)
                                .map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell>
                                            {editingId === group.id ? (
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-8"
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-green-600"
                                                        onClick={() => saveEdit(group.id)}
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-red-600"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{group.name}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingId !== group.id && (
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => startEdit(group)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => handleDelete(group.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-muted-foreground">
                To reorder groups, feature coming soon. (Currently sorted by creation/sort_order).
            </p>
        </div>
    );
}
