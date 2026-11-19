// 부두별 컨테이너 조회 화면. 순서가 중요: 'HBCT'가 'BCT'보다 먼저(포함 관계).
const TERMINALS: [string, string][] = [
  ['HJNC', 'https://www.hjnc.co.kr/esvc'],
  ['BNCT', 'https://info.bnctkorea.com/esvc'],
  ['HPNT', 'https://www.hpnt.co.kr/infoservice/cntr/cntrSearchList.jsp'],
  ['PNIT', 'https://www.pnitl.com/infoservice/cntr/cntrSearchList.jsp'],
  ['PNC', 'https://svc.pncport.com/info/Main.do'],
  ['DGT', 'https://info.dgtbusan.com/DGT/esvc'],
  ['HBCT', 'https://custom.hktl.com/jsp/T04/dataio_cntr.jsp'],
  ['BCT', 'https://info.bct2-4.com/infoservice/index.html'],
  ['BPT', 'http://www.bptc.co.kr:9084/content/cg/frame/cntr_frame_cg_kr.jsp?p_id=CONT_CN_KR&snb_num=1&snb_div=service'],
  ['신감만', 'https://custom.hktl.com/jsp/T04/dataio_cntr.jsp'],
  ['인터지스', 'https://www.e-iway.com/'],
]

/** 엑셀 '부두 및 창고' 칸(예: 'BPT-신선대', 'HGCT-신감만')으로 그 부두의 조회 주소. 모르는 부두면 null. */
export function terminalLink(terminal: string | null): { name: string; url: string } | null {
  const t = (terminal ?? '').toUpperCase()
  const hit = TERMINALS.find(([name]) => t.includes(name.toUpperCase()))
  return hit ? { name: hit[0], url: hit[1] } : null
}
