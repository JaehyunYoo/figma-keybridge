# Keybridge 문구 카탈로그

이 파일이 문구의 원본입니다. JSON은 자동 생성합니다.
status: draft / approved / needs-review. pendingSource는 Figma의 변경 제안입니다.

```keybridge
{
  "schema": "keybridge/v1",
  "sourceLocale": "ko",
  "entries": [
    {
      "key": "checkout.payButton",
      "source": "결제하기",
      "status": "approved",
      "translations": {
        "en": {
          "value": "Pay now",
          "status": "approved"
        },
        "ja": {
          "value": "支払う",
          "status": "approved"
        }
      },
      "refs": [
        {
          "documentId": "example-document",
          "nodeId": "12:34",
          "page": "Checkout",
          "frame": "Payment"
        }
      ]
    },
    {
      "key": "profile.greeting",
      "source": "{name}님, 안녕하세요",
      "status": "approved",
      "translations": {
        "en": {
          "value": "Hello, {name}",
          "status": "approved"
        },
        "ja": {
          "value": "こんにちは、{name}さん",
          "status": "approved"
        }
      },
      "refs": []
    }
  ]
}
```
