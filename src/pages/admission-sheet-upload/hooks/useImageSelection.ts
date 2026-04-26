import { useEffect, useState } from "react";
import { createImagePreview, revokeImagePreview } from "../lib/imageUpload";

export const useImageSelection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selectImage = (selectedFile: File) => {
    setFile(selectedFile);

    const nextPreview = createImagePreview(selectedFile);
    setPreview((currentPreview) => {
      revokeImagePreview(currentPreview);
      return nextPreview;
    });
  };

  const resetImage = () => {
    revokeImagePreview(preview);
    setFile(null);
    setPreview(null);
  };

  useEffect(function cleanupImagePreview() {
    return function revokeCurrentPreview() {
      revokeImagePreview(preview);
    };
  }, [preview]);

  return {
    file,
    preview,
    resetImage,
    selectImage,
  };
};
