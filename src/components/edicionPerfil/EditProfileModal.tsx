'use client'

import { User, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import UserProfileView from './UserProfileView';
import AdminProfileView from './AdminProfileView';
import SuperAdminProfileView from './SuperAdminProfileView';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const { user } = useAuth();

    if (!isOpen) return null;

    const renderByRole = () => {
        const role = user?.role || 'user';
        if (role === 'superadmin') return <SuperAdminProfileView />;
        if (role === 'admin') return <AdminProfileView />;
        return <UserProfileView />;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-3">
                            <User className="w-5 h-5 text-blue-600" />
                            Editar Perfil
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                                    <div className="p-4 bg-[var(--hover-bg)] rounded">
                                        {/* Render role specific content */}
                                        {renderByRole()}
                                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-[var(--hover-bg)] text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Click outside to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
