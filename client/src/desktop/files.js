import { getDesktopBridge, isDesktopApp } from './bridge';

export const pickImageFile = async () => {
  if (!isDesktopApp()) {
    return null;
  }

  return getDesktopBridge().files.pickImage();
};
