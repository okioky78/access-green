import { extractAdmissionInfoFromCertificate } from "../clients/admission-ai-client.ts";
import { parseMultipartFormData } from "../shared/image-multipart.ts";

export const extractAdmissionInfo = async (request: Request) => {
  const { file } = await parseMultipartFormData(request);

  return extractAdmissionInfoFromCertificate(file);
};
