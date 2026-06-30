# 粤鑫金实时行情看板

粤鑫金店内实时贵金属行情展示系统，包含金价大屏、实时走势图、店铺二维码、订单登记接口和本地局域网访问支持。

## 本地启动

```bash
npm install
npm start
```

默认监听 `0.0.0.0:3000`，同一局域网设备可通过电脑 IP 访问，例如：

```text
http://192.168.1.168:3000/
```

如需指定端口或主机：

```bash
PORT=3000 HOST=0.0.0.0 npm start
```

## 测试

```bash
node test/asset-versioning.test.js
node test/chart-axis-range.test.js
node test/current-price-marker.test.js
node test/header-qr.test.js
node test/header-single-row.test.js
node test/lan-listen.test.js
node test/mobile-chart-height.test.js
node test/mobile-health-page.test.js
node test/price-flash.test.js
node test/price-meta-layout.test.js
node test/terminal-chart-style.test.js
node test/terminal-chart-update.test.js
node test/visible-copy.test.js
```

## 数据说明

运行时会在 `data/` 下生成订单、登记和每日行情数据。该目录中的本机运行数据默认不提交到仓库，避免上传客户信息或历史运行记录。
