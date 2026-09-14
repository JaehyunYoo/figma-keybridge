# Keybridge 문구 카탈로그

이 파일이 문구의 원본입니다. JSON은 자동 생성합니다.
status: draft / approved / needs-review. pendingSource는 Figma의 변경 제안입니다.

```keybridge
{
  "schema": "keybridge/v1",
  "sourceLocale": "ko",
  "entries": [
    {
      "key": "checkout.confirm",
      "source": "주문 확인",
      "status": "draft",
      "translations": {},
      "introducedVersion": "1.1.1",
      "refs": [
        {
          "documentId": "example-document",
          "nodeId": "5",
          "page": "앱 화면",
          "frame": "주문 확인",
          "version": "1.1.1"
        }
      ]
    },
    {
      "key": "common.save",
      "source": "저장",
      "status": "draft",
      "translations": {},
      "introducedVersion": "1.1.0",
      "refs": [
        {
          "documentId": "example-document",
          "nodeId": "1",
          "page": "앱 화면",
          "frame": "프로필 수정",
          "version": "1.1.0"
        },
        {
          "documentId": "example-document",
          "nodeId": "1",
          "page": "앱 화면",
          "frame": "프로필 수정",
          "version": "1.1.1"
        },
        {
          "documentId": "example-document",
          "nodeId": "4",
          "page": "앱 화면",
          "frame": "배송지 수정",
          "version": "1.1.1"
        }
      ],
      "pendingSource": "저장하기"
    },
    {
      "key": "login.title",
      "source": "로그인",
      "status": "draft",
      "translations": {},
      "introducedVersion": "1.1.0",
      "refs": [
        {
          "documentId": "example-document",
          "nodeId": "2",
          "page": "앱 화면",
          "frame": "로그인",
          "version": "1.1.0"
        },
        {
          "documentId": "example-document",
          "nodeId": "2",
          "page": "앱 화면",
          "frame": "로그인",
          "version": "1.1.1"
        }
      ]
    },
    {
      "key": "profile.subtitle",
      "source": "내 정보를 관리하세요",
      "status": "draft",
      "translations": {},
      "introducedVersion": "1.1.0",
      "refs": [
        {
          "documentId": "example-document",
          "nodeId": "3",
          "page": "앱 화면",
          "frame": "프로필 수정",
          "version": "1.1.0"
        }
      ]
    }
  ],
  "versionRecords": [
    {
      "version": "1.1.0",
      "scope": "observed",
      "entries": [
        {
          "key": "common.save",
          "value": "저장",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "1",
              "page": "앱 화면",
              "frame": "프로필 수정",
              "version": "1.1.0"
            }
          ]
        },
        {
          "key": "login.title",
          "value": "로그인",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "2",
              "page": "앱 화면",
              "frame": "로그인",
              "version": "1.1.0"
            }
          ]
        },
        {
          "key": "profile.subtitle",
          "value": "내 정보를 관리하세요",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "3",
              "page": "앱 화면",
              "frame": "프로필 수정",
              "version": "1.1.0"
            }
          ]
        }
      ]
    },
    {
      "version": "1.1.1",
      "scope": "observed",
      "entries": [
        {
          "key": "common.save",
          "value": "저장하기",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "1",
              "page": "앱 화면",
              "frame": "프로필 수정",
              "version": "1.1.1"
            },
            {
              "documentId": "example-document",
              "nodeId": "4",
              "page": "앱 화면",
              "frame": "배송지 수정",
              "version": "1.1.1"
            }
          ]
        },
        {
          "key": "login.title",
          "value": "로그인",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "2",
              "page": "앱 화면",
              "frame": "로그인",
              "version": "1.1.1"
            }
          ]
        },
        {
          "key": "checkout.confirm",
          "value": "주문 확인",
          "refs": [
            {
              "documentId": "example-document",
              "nodeId": "5",
              "page": "앱 화면",
              "frame": "주문 확인",
              "version": "1.1.1"
            }
          ]
        }
      ]
    }
  ]
}
```
