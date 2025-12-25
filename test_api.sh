#!/bin/bash

# 测试兔小巢API接口
echo "正在测试兔小巢API接口..."

curl -X GET \
  'https://txc.qq.com/api/v2/330701/dashboard/posts/list?page=1&count=100&from=2025-06-17%2014%3A04%3A50&to=2025-06-17%2014%3A19%3A50&status=0&order=1&label=all' \
  -H 'Accept: */*' \
  -H 'accept-encoding: gzip, deflate, br, zstd' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5' \
  -H 'connection: keep-alive' \
  -H 'cookie: _tucao_session=SVpuaTA2K1hQN1dxZmZuejdZaGZWN1lLM2NoRGFOLzhXZGZnNXlvUmJNTi9zYXdlMGpEVUU3b09jcDd3azhNdlA1UmJBVFVhcklwbm9ZS1RGbG9RSXJYRklMSDIxQjVnaEIyaXBrdGFwNEJWQ3hPOWJwME9rQnJQbzJVQU9qNHU%3D--gu3U7XeFySNEdKcq2CfLlQ%3D%3D--NmQyMDI5OTI2NDk3NTNhY2JjZGYwYjZmYWFhOWUzZDg%3D; ptcz=269d290c3fc34d3d139bf25ec8d35927cb897d7279c3e5944ac10a135c0e9eea; __wj_userid=ff72fcbb-7901-49c2-8a0a-59e35ad18a00; _horizon_uid=ff72fcbb-7901-49c2-8a0a-59e35ad18a00; RK=DgF4puhKbZ; ptui_loginuin=2014327412; _horizon_sid=1cc7ac20-96ef-489c-9936-a8a2d06c4b69' \
  -H 'host: txc.qq.com' \
  -H 'referer: https://txc.qq.com/dashboard/all-posts' \
  -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  --compressed \
  -w '\nHTTP Status: %{http_code}\n' \
  -v

echo "\n测试完成"