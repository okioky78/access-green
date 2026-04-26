import { extractPaymentDateFromReceipt } from "../clients/receipt-ai-client.ts";
import { parseMultipartFormData } from "../shared/image-multipart.ts";

export const extractPaymentDate = async (request: Request) => {
  const { file } = await parseMultipartFormData(request);
  const paymentDate = await extractPaymentDateFromReceipt(file);

  return {
    paymentDate,
  };
};
