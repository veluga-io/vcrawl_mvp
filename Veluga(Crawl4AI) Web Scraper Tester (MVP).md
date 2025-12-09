# **제품 요구사항 정의서 (PRD)**

## **프로젝트명: Veluga(Crawl4AI) Web Scraper Tester (MVP)**

| 항목 | 내용 |
| :---- | :---- |
| **작성일** | 2024년 11월 29일 |
| **상태** | Draft (초안) |
| **버전** | v1.0 |
| **목표** | Crawl4AI 엔진을 활용하여 URL 입력 시 HTML 및 LLM 친화적 Markdown 결과를 즉시 확인하는 테스트 UI 구축 |

## **1\. 개요 (Overview)**

### **1.1 배경**

대규모 언어 모델(LLM) 학습 및 RAG(Retrieval-Augmented Generation) 시스템 구축을 위해서는 웹상의 데이터를 깨끗한 텍스트나 Markdown 형태로 추출하는 것이 필수적입니다. crawl4ai는 이러한 목적에 최적화된 오픈소스 도구입니다. 현재 다양한 웹사이트가 이 도구를 통해 어떻게 파싱되는지 빠르고 직관적으로 검증할 수 있는 GUI 도구가 부재하여, 이를 웹 기반의 MVP로 구축하고자 합니다.

### **1.2 제품 목표 (Goals)**

* **사용자 편의성:** CLI(명령줄)가 아닌 웹 UI를 통해 누구나 쉽게 URL을 입력하고 결과를 확인할 수 있어야 합니다.  
* **데이터 검증:** 원본 HTML과 변환된 Markdown을 비교하여 데이터 손실이나 파싱 오류를 즉시 확인할 수 있어야 합니다.  
* **MVP 범위:** 1차 범위는 단일 URL에 대한 동기적(Synchronous) 처리 및 결과 뷰어 기능에 집중합니다.

## **2\. 사용자 스토리 (User Stories)**

1. **사용자**는 테스트하고 싶은 웹사이트의 URL을 입력창에 붙여넣고 '분석' 버튼을 클릭할 수 있다.  
2. **사용자**는 분석이 진행되는 동안 로딩 인디케이터를 통해 진행 상황을 인지할 수 있다.  
3. **사용자**는 분석 완료 후 결과 화면에서 \*\*'Markdown(LLM용)'\*\*과 \*\*'Raw HTML'\*\*을 탭으로 전환하며 내용을 확인할 수 있다.  
4. **사용자**는 결과 텍스트를 클립보드에 복사하여 다른 메모장이나 LLM 프롬프트에 붙여넣을 수 있다.  
5. **사용자**는 유효하지 않은 URL이나 스크래핑 실패 시(Time-out, Access Denied 등) 적절한 에러 메시지를 확인할 수 있다.

## **3\. 기능 요구사항 (Functional Requirements)**

### **3.1 입력 (Input)**

* **URL 입력 필드:**  
  * http:// 또는 https:// 프로토콜을 포함한 URL 입력을 받는다.  
  * 입력 값이 없을 경우 버튼을 비활성화하거나 경고를 표시한다.  
* **옵션 설정 (MVP Optional):**  
  * *JavaScript 실행 여부 (js\_code, wait\_for 등은 MVP에서 제외하고 기본값 사용)*  
  * *Word Count Threshold (의미 없는 단어수 필터링) \- 기본값 적용*

### **3.2 처리 (Processing \- Backend)**

* **Crawl4AI 연동:**  
  * Python 백엔드에서 crawl4ai 라이브러리의 AsyncWebCrawler를 인스턴스화하여 요청을 처리한다.  
  * 기본 전략: bypass\_cache=True (항상 최신 데이터 요청).  
* **데이터 정제:**  
  * result.markdown: LLM 친화적인 마크다운 추출.  
  * result.cleaned\_html 또는 result.html: 원본 소스 확보.  
* **예외 처리:**  
  * 타임아웃(기본 30초 설정).  
  * Anti-bot 솔루션에 의한 차단 감지 시 에러 반환.

### **3.3 출력 및 표시 (Output & Display)**

* **결과 뷰어:**  
  * **Tab 1: Markdown (Default)** \- 렌더링된 마크다운 뷰가 아닌, **Raw Markdown 텍스트**를 보여주어야 함 (LLM 입력용이기 때문). 가독성을 위해 Syntax Highlighting 적용 권장.  
  * **Tab 2: HTML** \- 소스 코드 뷰어 형태로 제공 (너무 길 경우 접기/펼치기 또는 스크롤 처리).  
* **메타데이터 표시:**  
  * 성공 여부 (Success/Fail).  
  * 총 소요 시간.  
* **유틸리티:**  
  * '전체 복사(Copy to Clipboard)' 버튼.

## **4\. 비기능 요구사항 (Non-Functional Requirements)**

* **성능:** 단일 페이지 처리는 평균 5\~10초 이내에 결과를 반환해야 함 (대상 사이트 속도에 의존).  
* **확장성:** 추후 옵션(User Agent 변경, 세션 관리 등)을 추가하기 쉬운 구조여야 함.  
* **환경:**  
  * crawl4ai는 Playwright를 사용하므로 서버 환경에 브라우저 바이너리 설치가 필요함.  
  * Docker 컨테이너 기반 배포를 권장.

## **5\. 시스템 아키텍처 및 기술 스택 (권장)**

### **5.1 기술 스택**

* **Backend:** Python 3.9+  
  * Framework: **FastAPI** (비동기 처리에 유리하며 crawl4ai의 async 기능과 궁합이 좋음).  
  * Library: crawl4ai, playwright.  
* **Frontend:**  
  * Framework: **React** (Vite) 또는 단순함을 위해 **Streamlit**(Python Only로 빠른 구축 가능).  
  * *본 PRD는 확장성을 고려하여 React \+ FastAPI 구조를 가정함.*  
* **Deployment:** Docker.

### **5.2 데이터 흐름도 (Sequence Diagram)**

sequenceDiagram  
    participant User  
    participant UI as Frontend(React)  
    participant API as Backend(FastAPI)  
    participant Crawler as Crawl4AI Engine  
    participant Web as Target Website

    User-\>\>UI: URL 입력 및 '크롤링' 클릭  
    UI-\>\>API: POST /api/crawl {url: "..."}  
    Note over UI: 로딩 스피너 표시  
    API-\>\>Crawler: arun(url=url) 호출  
    Crawler-\>\>Web: HTTP Request (Headless Browser)  
    Web--\>\>Crawler: HTML Response (JS Rendered)  
    Crawler-\>\>Crawler: HTML to Markdown 변환 & 정제  
    Crawler--\>\>API: Result Object 반환  
    API--\>\>UI: JSON {markdown: "...", html: "..."}  
    UI-\>\>User: 결과 화면 표시 (Markdown/HTML 탭)

## **6\. UI/UX 와이어프레임 명세**

### **6.1 메인 레이아웃**

* **Header:** 로고 및 타이틀 "Crawl4AI Tester".  
* **Search Bar Section (중앙 상단):**  
  * 긴 Input Box (Placeholder: "https://example.com").  
  * Action Button: \[Analyze\] (Primary Color).  
* **Content Area (하단):**  
  * 초기 상태: 사용 방법 안내 ("URL을 입력하여 테스트하세요").  
  * 로딩 상태: "웹사이트를 방문하고 분석 중입니다..." 메시지와 스피너.  
  * 결과 상태:  
    * 상단: 상태 배지 (성공/실패), 응답 속도.  
    * 탭 메뉴: \[Markdown\] | \[Cleaned HTML\].  
    * 코드 블록 영역: 결과 텍스트 출력 (Monospace 폰트, 스크롤 가능).  
    * 플로팅 버튼 또는 우측 상단 버튼: \[복사하기\].

## **7\. API 명세 (Draft)**

### **POST /api/v1/crawl**

**Request Body:**

{  
  "url": "\[https://news.ycombinator.com\](https://news.ycombinator.com)",  
  "word\_count\_threshold": 10  
}

**Response (200 OK):**

{  
  "success": true,  
  "markdown": "\#\# Hacker News\\n\\n1. ...",  
  "html": "\<html\>...\</html\>",  
  "metadata": {  
    "title": "Hacker News",  
    "execution\_time": 1.25  
  }  
}

**Response (Error):**

{  
  "success": false,  
  "error\_message": "Timeout waiting for selector..."  
}  
