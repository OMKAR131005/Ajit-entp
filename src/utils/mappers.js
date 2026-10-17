export const toCamelCustomer = (r) => ({
  id: String(r.id),
  name: r.name,
  mobile: String(r.mobile ?? ""),
  address: r.address,
  idProofType: r.id_proof_type || "",
  idProofPath: r.id_proof_path || "",
  idProofFileName: r.id_proof_file_name || "",
  createdAt: r.created_at,
});

export const toCamelLead = (r) => ({
  leadId: String(r.lead_id),
  customerId: r.customer_id,
  feUsername: r.fe_username,
  feName: r.fe_name,
  visitDate: r.visit_date,
  deviceBrand: r.device_brand,
  deviceModel: r.device_model,
  expectedPrice: Number(r.expected_price) || 0,
  purchasePrice: Number(r.purchase_price) || 0,
  commission: Number(r.commission) || 0,
  commissionAmount: Number(r.commission_amount) || 0,
  status: r.status,
  remarks: r.remarks || "",
  createdAt: r.created_at,
  colour: r.colour || "",
  ram: r.ram || "",
  rom: r.rom || "",
  accessories: r.accessories || "",
  imei1: String(r.imei1 ?? ""),
  updatedAt: r.updated_at || "",
  updatedBy: r.updated_by || "",
});

export const toCamelFe = (r) => ({
  username: r.username,
  name: r.name,
  active: r.active === true || String(r.active).toLowerCase() === "true",
});