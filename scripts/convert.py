"""엑셀(xlsx로 변환된 파일) -> data/customers.json"""
import sys, json, re, openpyxl
src, dst = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src).active
rows = list(ws.iter_rows(values_only=True))
H = {h: i for i, h in enumerate(rows[0])}

def s(v):
    return "" if v is None else str(v).strip()
def phone(v):
    v = re.sub(r"\s+", "", s(v))
    return "" if re.fullmatch(r"\d*-?", v) else v   # '02-' '01-' 같은 빈 값 제거
def date(v):
    v = s(v).replace(".", "-")
    return v if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else ""
def num(v):
    try: return int(float(s(v).replace(",", "") or 0))
    except ValueError: return 0
def g(r, k): return r[H[k]]

out = []
for r in rows[1:]:
    if not s(r[0]): continue
    filters = []
    for n in range(1, 10):
        name = s(g(r, f"필터명{n}/9")); cyc = num(g(r, f"주기{n}/9")); last = date(g(r, f"최근교환{n}/9"))
        if name and cyc > 0 and last:
            filters.append({"name": name, "cycleDays": cyc, "lastChange": last})
    out.append({
        "id": s(g(r, "관리번호")), "regDate": date(g(r, "등록일자")), "manager": s(g(r, "담 당 자")),
        "name": s(g(r, "고 객 명")), "contactPerson": s(g(r, "고객정보")), "category": s(g(r, "고객분류")),
        "title": s(g(r, "고객호칭")), "productNo": s(g(r, "제품번호")), "referrer": s(g(r, "소 개 처")),
        "email": s(g(r, "전자메일")), "zip": s(g(r, "우편번호")),
        "addr1": s(g(r, "고객주소(1)")), "addr2": s(g(r, "고객주소(2)")),
        "tel1": phone(g(r, "연락처(1)")), "tel2": phone(g(r, "연락처(2)")),
        "mobile1": phone(g(r, "휴대폰(1)")), "mobile2": phone(g(r, "휴대폰(2)")),
        "note1": s(g(r, "약도설명 1/2")), "note2": s(g(r, "약도설명 2/2")),
        "ref1": s(g(r, "참고내용 1/2")), "ref2": s(g(r, "참고내용 2/2")),
        "model": s(g(r, "모 델 명")), "motor": s(g(r, "모 터 명")),
        "memo": (s(g(r, "메모사항")) + " " + s(g(r, "메모장"))).strip(),
        "mgmtType": s(g(r, "관리방법")), "saleType": s(g(r, "판매구분")),
        "monthlyFee": num(g(r, "월납입액")), "etc": s(g(r, "기타사항")), "filters": filters,
    })
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "customers")
