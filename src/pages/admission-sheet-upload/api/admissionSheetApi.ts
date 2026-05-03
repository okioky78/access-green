import { apiClient } from "../../../shared/api";

export type AdmissionInfo = {
  name: string;
  university: string;
  college: string;
  department: string;
  admissionType: string;
  examineeNumber: string;
};

export type AuthStatusResponse = {
  success?: boolean;
  authenticated?: boolean;
  message?: string;
};

export type AdmissionSheetSaveResponse = {
  success: boolean;
  driveFileUrl: string;
  filename: string;
};

type AdmissionSheetSavePayload = {
  file: File;
  data: AdmissionInfo;
};

export const logoutGoogle = async () =>
  (await apiClient.post<AuthStatusResponse>("/google-auth-logout")).data;

export const extractAdmissionInfo = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return (await apiClient.post<AdmissionInfo>("/extract-admission-info", formData)).data;
};

export const saveAdmissionToSheet = async ({
  file,
  data,
}: AdmissionSheetSavePayload) => {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return (await apiClient.post<AdmissionSheetSaveResponse>("/send-to-sheet", formData)).data;
};
