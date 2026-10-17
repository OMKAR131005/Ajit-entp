import { Check, Clock, XCircle } from "lucide-react";
import { C } from "./colors";

export const STATUS_META = {
  Completed: { fg: C.ledger, bg: C.ledgerBg, Icon: Check },
  Pending: { fg: C.amber, bg: C.amberBg, Icon: Clock },
  Cancelled: { fg: C.rust, bg: C.rustBg, Icon: XCircle },
};