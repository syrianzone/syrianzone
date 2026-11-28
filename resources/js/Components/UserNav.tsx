import React from 'react';
import { api, apiErrorMessage } from '@/Lib/api';
import { Link } from '@inertiajs/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { Button } from '@/Components/ui/button';
import { LogOut, User as UserIcon, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { useCan } from '@/Lib/useCan';
import { CAPABILITIES } from '@/Lib/capabilities';
import { notify } from '@/Lib/notify';

export default function UserNav() {
    const { user } = useAuth();
    const can = useCan();

    const logout = () => {
        api.post('/logout')
            .then(() => {
                window.location.reload();
            })
            .catch((err) => {
                notify.error(apiErrorMessage(err, 'تعذّر تسجيل الخروج'));
            });
    };

    if (!user) {
        return null;
    }

    const hasAdminAccess = user.role === 'superadmin' || CAPABILITIES.some((capability) => can(capability));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    aria-label="قائمة الحساب"
                    className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0"
                >
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border border-border/50">
                        <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="me-2 h-4 w-4" aria-hidden="true" />
                        <span>حسابي</span>
                    </Link>
                </DropdownMenuItem>
                {hasAdminAccess && (
                    <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                            <Shield className="me-2 h-4 w-4" aria-hidden="true" />
                            <span>لوحة الإدارة</span>
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <Link href="/dashboard?tab=account" className="cursor-pointer">
                        <UserIcon className="me-2 h-4 w-4" aria-hidden="true" />
                        <span>إعدادات الحساب</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={logout}
                >
                    <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
                    <span>تسجيل الخروج</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
