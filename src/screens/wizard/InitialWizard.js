import { DEFAULT_ACCESSORIES } from "../../constants/accessories";

export const STEPS = ["mobile", "customer", "device", "kit", "leadid", "commission", "idproof", "finish"];

export function initialWizard({ customerId, mobile, skipTo } = {}) {
  return {
    step: skipTo === "device" ? "device" : "mobile",
    mobile: mobile || "",
    customerId: customerId || null,
    isNewCustomer: false,
    customerDraft: { name: "", address: "" },
    idProofTypes: [], idProofFilesByType: {},
    leadId: "",
    deviceBrand: "", deviceModel: "", deviceColour: "", deviceRam: "", deviceRom: "",
    imei: "", accessories: [...DEFAULT_ACCESSORIES],
    expectedPrice: "", purchasePrice: "",
    commission: "", status: "Completed", remarks: "",
    saved: false,
  };
}
