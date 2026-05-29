import { useState, useCallback, useRef } from "react";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/config/firebase";
import { compressImage, validateImageFile } from "../utils/imageUtils";
import { UsersService } from "../services/users";
import type { User as UserRecord } from "../types/firestore";

interface UseProfileImageUploadOptions {
  user: UserRecord | null;
  onSuccess?: (photoUrl: string) => void;
  onError?: (error: string) => void;
  onDeleteSuccess?: () => void;
}

export function useProfileImageUpload({
  user,
  onSuccess,
  onError,
  onDeleteSuccess,
}: UseProfileImageUploadOptions) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.isValid) {
        const errorMsg = validation.error || "Archivo de imagen inválido";
        onError?.(errorMsg);
        return;
      }

      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setPendingDelete(false);
    },
    [onError],
  );

  const markForDeletion = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPendingDelete(true);
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
    setPendingDelete(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!selectedFile || !user?.id) return null;

    setIsUploading(true);

    try {
      const compressedBlob = await compressImage(selectedFile);

      const fileName = `${user.id}.jpg`;
      const storageRef = ref(storage, `ProfileImages/${fileName}`);

      await uploadBytes(storageRef, compressedBlob, {
        contentType: "image/jpeg",
      });

      const downloadURL = await getDownloadURL(storageRef);

      const targetId = user.id;
      await UsersService.updateUserAs(user, targetId, {
        photoUrl: downloadURL,
      });

      setSelectedFile(null);
      setImagePreview(null);
      setPendingDelete(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      onSuccess?.(downloadURL);
      return downloadURL;
    } catch (err) {
      console.error("Error uploading image:", err);
      const message =
        err instanceof Error ? err.message : "Error al subir la imagen";
      onError?.(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, user, onSuccess, onError]);

  const confirmDelete = useCallback(async () => {
    if (!user?.id) return;

    setIsDeleting(true);

    try {
      const fileName = `${user.id}.jpg`;
      const storageRef = ref(storage, `ProfileImages/${fileName}`);
      try {
        await deleteObject(storageRef);
      } catch (storageErr: any) {
        if (storageErr?.code !== "storage/object-not-found") {
          throw storageErr;
        }
      }

      const targetId = user.id;
      await UsersService.updateUserAs(user, targetId, { photoUrl: undefined });

      if (selectedFile) {
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }

      setPendingDelete(false);
      onDeleteSuccess?.();
    } catch (err) {
      console.error("Error deleting image:", err);
      const message =
        err instanceof Error ? err.message : "Error al eliminar la imagen";
      onError?.(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [user, selectedFile, onError, onDeleteSuccess]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    selectedFile,
    imagePreview,
    isUploading,
    isDeleting,
    pendingDelete,
    fileInputRef,

    handleFileSelect,
    uploadImage,
    confirmDelete,
    markForDeletion,
    cancelSelection,
    openFileDialog,

    hasSelectedFile: selectedFile !== null,
    canDelete: Boolean(!pendingDelete && (user?.photoUrl || selectedFile)),
    isProcessing: isUploading || isDeleting,
  };
}
