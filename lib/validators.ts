import type { Payment, ServiceRecord } from "./types";
export const validatePayment = (b: Partial<Payment>) =>
  !b.customerId ? "고객이 지정되지 않았습니다." : !b.date ? "날짜를 입력해 주세요." : !(Number(b.amount) > 0) ? "금액을 입력해 주세요." : null;
export const validateRecord = (b: Partial<ServiceRecord>) =>
  !b.customerId ? "고객이 지정되지 않았습니다." : !b.date ? "날짜를 입력해 주세요." : !b.type ? "구분을 선택해 주세요." : null;
