import { RECORD_TYPES, type Payment, type ServiceRecord } from "./types";
export const validatePayment = (b: Partial<Payment>) =>
  !b.customerId ? "고객이 지정되지 않았습니다." : !b.date ? "날짜를 입력해 주세요." : !(Number(b.amount) > 0) ? "금액을 입력해 주세요."
  : b.kind !== "수납" && b.kind !== "청구" ? "수납/청구 구분이 올바르지 않습니다." : null;
export const validateRecord = (b: Partial<ServiceRecord>) =>
  !b.customerId ? "고객이 지정되지 않았습니다." : !b.date ? "날짜를 입력해 주세요." : !b.type ? "구분을 선택해 주세요."
  : !RECORD_TYPES.includes(b.type) ? "구분이 올바르지 않습니다." : null;
