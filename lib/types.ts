export type FilterItem = {
  name: string;
  cycleDays: number; // 교환 주기(일)
  lastChange: string; // YYYY-MM-DD
};

export type Customer = {
  id: string; // 관리번호
  regDate: string; // 등록일자
  manager: string; // 담당자
  name: string; // 고객명
  contactPerson: string; // 고객정보(담당/가족)
  category: string; // 고객분류
  title: string; // 고객호칭
  productNo: string; // 제품번호
  referrer: string; // 소개처
  email: string;
  zip: string;
  addr1: string;
  addr2: string;
  tel1: string;
  tel2: string;
  mobile1: string;
  mobile2: string;
  note1: string; // 약도/비고 1
  note2: string; // 약도/비고 2
  ref1: string; // 참고내용 1
  ref2: string; // 참고내용 2
  model: string; // 모델명
  motor: string; // 모터명
  memo: string; // 메모사항
  mgmtType: string; // 관리방법 (CMS/수금 등)
  saleType: string; // 판매구분
  monthlyFee: number; // 월납입액
  etc: string; // 기타사항
  filters: FilterItem[];
  // 지도용 좌표 캐시 (주소가 바뀌면 geoAddr가 달라져 자동으로 다시 변환)
  lat?: number;
  lng?: number;
  geoAddr?: string;
  roadAddr?: string; // 카카오가 변환해 준 도로명 주소 (찾지 못하면 빈 문자열)
};

export type Payment = {
  id: string;
  customerId: string;
  date: string; // YYYY-MM-DD
  kind: "수납" | "청구";
  amount: number;
  method: string; // 현금/카드/CMS/계좌이체 …
  memo: string;
};

export const RECORD_TYPES = ["방문", "필터교체", "AS", "상담", "민원", "특이사항"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type ServiceRecord = {
  id: string;
  customerId: string;
  date: string;
  type: RecordType;
  content: string;
  nextVisit: string; // 다음 방문 예정일 (선택)
  filters?: { name: string; prev: string }[]; // 필터교체 기록과 연결된 필터 (prev = 교체 전 교환일)
};

export type ImportLog = {
  id: string;
  at: string; // ISO
  fileName: string;
  added: number;
  updated: number;
  unchanged: number;
  errors: number;
};
