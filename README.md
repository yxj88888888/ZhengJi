# 西部郑记固定金价展示

西部郑记门店金价展示页。首页展示固定的今日金价和回购金价，不再显示走势图；金价通过受账号密码保护的后台入口手动修改。

## EdgeOne Pages 部署

- 发布目录：`public`
- Edge Function：`edge-functions/gold-api/[[default]].js`
- KV 绑定变量名：`ZHENGJI_GOLD_KV`
- 固定金价 KV key：`zhengji_gold_fixed_current`

建议在 EdgeOne Pages 环境变量里配置：

```text
ZHENGJI_ADMIN_USER=自定义账号
ZHENGJI_ADMIN_PASSWORD=自定义强密码
ZHENGJI_DEFAULT_SALE_PRICE=1130
ZHENGJI_DEFAULT_BUYBACK_PRICE=1026.5
```

如果未配置账号密码，后台默认账号为 `admin`，默认密码为 `zhengji2026`。正式上线前建议改成自己的账号密码。

## 访问地址

- 首页：`/`
- 健康检查：`/gold-api/health`
- 当前金价：`/gold-api/gold/current`
- 兼容历史接口：`/gold-api/gold/history`
- 修改金价后台：`/gold-api/admin`

打开 `/gold-api/admin` 会弹出账号密码窗口。登录后填写今日金价和回购金价，保存后首页会在几秒内刷新。

## 本地启动

```bash
npm install
npm start
```

## 测试

```bash
node test/asset-versioning.test.js
node test/edgeone-function.test.js
node test/header-qr.test.js
node test/header-single-row.test.js
node test/lan-listen.test.js
node test/mobile-health-page.test.js
node test/price-flash.test.js
node test/price-meta-layout.test.js
node test/visible-copy.test.js
```
