# ♿ 사천 배리어프리 지도 (Barrier-Free Map)

> 교통약자(휠체어, 유모차, 보행 보조기 이용자, 임산부 등)의 안전하고 편리한 이동을 돕기 위해 길 상태를 시각화하고 제보하는 **모바일 최적화 웹 애플리케이션(SPA)**입니다.

오픈스트리트맵(OSM)과 Leaflet.js를 기반으로 길 상태를 교통 체증 지도처럼 직관적으로 시각화하며, 중학생 제보자도 스마트폰으로 손쉽게 길 상태를 표시하여 데이터베이스에 제보할 수 있도록 직관적인 UI를 제공합니다.

---

## 🌟 주요 기능

1. **길 상태 색상 시각화 (교통 정보 형태)**
   - 🟢 **녹색 (이동 편리)**: 단차가 없고 경사가 완만하여 휠체어/유모차 이동이 수월한 길.
   - 🟡 **황색 (주의 필요)**: 노면이 고르지 않거나 경사가 다소 가파른 길.
   - 🔴 **적색 (이동 불가)**: 계단이 있거나 단차가 높아 휠체어/유모차가 통행할 수 없는 길.
   - 모바일 기기 화면에서도 눈에 잘 띄도록 두껍고 선명한 선 두께(7px)로 렌더링됩니다.

2. **직관적인 구간 제보 및 기록 시스템**
   - **구간 평가 모드**에 진입한 후 지도 위에 시작점과 끝점을 터치하면 임시 가이드 선이 그려집니다.
   - 신호등 색상의 커다란 버튼 3개(🟢 편리한 길, 🟡 주의가 필요한 길, 🔴 이동 불가능한 길)를 통해 직관적으로 평가를 완료할 수 있습니다.

3. **실시간 내 위치 찾기 (GPS)**
   - Geolocation API를 활용해 지도상에서 본인의 위치(오차 범위 표시 및 파란색 펄스 마커)를 즉시 탐색할 수 있습니다.
   - 기본 중심점은 사천시청 근처로 설정되어 있어 GPS를 켤 수 없는 상황에서도 손쉽게 주변을 파악하고 테스트할 수 있습니다.

4. **하이브리드 데이터베이스 서비스 (Firestore & LocalStorage)**
   - Firebase 설정을 하지 않은 경우에도 즉시 실행 가능하도록 **웹 브라우저 로컬 저장소(LocalStorage)에 기반한 데모 모드**로 작동합니다.
   - 우측 상단의 ⚙️ **설정 버튼**을 통해 본인의 Firebase Firestore 설정을 입력하면 실시간으로 클라우드 데이터베이스에 연결 및 저장됩니다.

---

## 🛠 기술 스택

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (ES Module)
- **Map Library**: Leaflet.js
- **Map Data**: OpenStreetMap (OSM)
- **Database**: Firebase v9 Firestore (Modular SDK) / LocalStorage Fallback
- **Icons**: FontAwesome 6.4.0
- **Fonts**: Google Fonts (Noto Sans KR, Inter)

---

## 🚀 로컬 실행 방법

이 프로젝트는 빌드 도구(Webpack, Vite 등)가 필요 없는 순수 SPA로, 로컬 웹 서버만 있으면 즉시 동작합니다.

### 1. 프로젝트 다운로드
```bash
git clone https://github.com/semyo0513/Barrier-free-map.git
cd Barrier-free-map
```

### 2. 로컬 웹 서버 구동
Node.js 또는 Python 등을 이용해 간단히 로컬 웹 서버를 구동해 실행할 수 있습니다.

**Node.js를 사용하는 경우:**
```bash
# http-server 설치 및 구동
npx http-server . -p 8080
```

**Python을 사용하는 경우:**
```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`으로 접속하여 즉시 지도를 확인할 수 있습니다.

---

## ⚙️ Firebase Firestore 연결 설정

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 새 프로젝트를 생성합니다.
2. **Firestore Database**를 활성화하고, 규칙(Rules)에서 쓰기 및 읽기 권한을 허용합니다.
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // 개발/테스트용 설정
       }
     }
   }
   ```
3. 프로젝트 설정에서 **웹(Web) 앱**을 추가하고 Firebase SDK 구성 키를 복사합니다.
4. 배포된 배리어프리 지도 웹앱 우측 상단의 ⚙️ **설정 버튼**을 누르고, 복사한 설정 값들을 양식에 붙여넣은 뒤 **"설정 저장 및 연결"**을 클릭합니다.
5. 설정이 완료되면 웹앱이 자동으로 새로고침되며 데이터베이스 상태 표시줄이 `로컬 저장소`에서 `Firebase`로 전환됩니다. 이후 제보한 모든 길 정보는 본인의 Firestore `paths` 컬렉션에 실시간으로 기록 및 동기화됩니다.

---

## 📂 폴더 구조

```text
Barrier-free-map/
├── index.html        # 메인 웹 페이지 구조
├── style.css         # UI 스타일링 (글래스모피즘, 모바일 레이아웃)
├── app.js            # 지도 렌더링, 제보 상태기 머신, DB 통신 비즈니스 로직
├── .gitignore        # Git 제외 설정 파일
└── README.md         # 프로젝트 소개 및 문서
```

---

## 📝 라이선스
이 프로젝트는 교육 및 사회 공헌을 위한 오픈소스 프로젝트입니다. 자유롭게 수정하여 사천시뿐 아니라 다른 지역의 배리어프리 지도를 만드는 데 사용하실 수 있습니다.
