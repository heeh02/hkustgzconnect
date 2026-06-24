<div align="center">

<img src="desktop/assets/logo.svg" alt="HKUST(GZ)" height="84" />

# hkustgzconnect

**香港科技大学(广州)校园 SSL-VPN 的原生客户端**
Native client for the HKUST(GZ) campus SSL‑VPN (Sangfor EasyConnect)

零 Rosetta · 零 Docker · 纯原生 · 一键连接 · 直连校内 HPC

</div>

---

## 这是什么

学校的 EasyConnect 官方客户端在 Apple Silicon 上要么靠 x86 模拟、要么会抢系统路由把别的代理/UDP 弄坏。
本项目用 [**zju-connect**](https://github.com/Mythologyli/zju-connect)(深信服 EasyConnect 协议的纯 Go 重实现)做引擎,
封装成一个**简洁的桌面应用**和一个**命令行工具**:登录后起一个本地 SOCKS5,把校内/HPC 流量(`10.120.0.0/16`)
经隧道送进去,**其它流量完全不受影响、系统路由表不被碰**。

实测网关 `remote.hkust-gz.edu.cn` 为深信服 **M7.6.8R2**,鉴权是**纯 用户名+密码**(无 SSO/验证码/短信/分组),
所以原生客户端可直接登录。

## 功能

- 🔐 **账号登录** —— 密码存系统安全区(macOS Keychain / Windows DPAPI),不落明文、不进 `ps`
- 🔌 **一键连接开关**
- 🎚️ **端口设置** —— SOCKS 端口可改(默认 `1080`)
- 🌐 **浏览器一键直连** —— 内置 PAC(只让校园站走隧道、其余直连),一键复制 SOCKS/PAC 地址,或直接开一个独立 Chrome 访问校园网站
- 🖥️ **HPC 直连** —— 配好 `ssh` 即可 `ssh hpc3`,`scp`/`rsync` 照常
- 🧩 **与 Clash 等代理共存** —— 独立本地 SOCKS,不改系统代理/默认路由
- 🔒 **单实例** —— 防止重复登录把自己的会话顶掉(网关每账号仅一会话)

## 下载

到 [Releases](../../releases) 下载:

| 平台 | 文件 |
|---|---|
| macOS (Apple Silicon / Intel) | `hkustgzconnect-*-mac-*.dmg` |
| Windows (x64) | `hkustgzconnect-*-win-*.exe` |
| Android | 🚧 二期(见 [`android/`](android/)) |

> macOS 首次打开若提示"未受信任的开发者",右键 → 打开;或 `xattr -dr com.apple.quarantine /Applications/hkustgzconnect.app`(未签名构建)。

## 使用(桌面)

1. 打开 app → 填 **账号 / 密码** → 点 **连接**。
2. 连上后状态变绿并显示校内 IP。HPC 走下面的 `ssh` 配置即可。

### SSH 上 HPC
`~/.ssh/config`(或 `~/.ssh/hkustgzconnect.conf` 由其 `Include`):
```sshconfig
Host hpc2 hpc3 *.hpc.hkust-gz.edu.cn 10.120.*
    ProxyCommand /usr/bin/nc -X 5 -x 127.0.0.1:1080 %h %p
```
之后 `ssh hpc3` 自动经隧道。端口改了就把 `1080` 同步改掉。

## 命令行版(CLI)

仓库根目录的 [`hkustgzconnect`](hkustgzconnect) 是个零依赖的 macOS/Linux 控制脚本(引擎同一个):
```bash
cp config.toml.example config.toml   # 填 username
./hkustgzconnect set-password         # 密码进 Keychain
./hkustgzconnect up                   # 起隧道
./hkustgzconnect status / test / down
./hkustgzconnect install              # 开机自启(launchd)
```
详见脚本内 `--help`。

## 从源码构建

```bash
cd desktop
npm install
bash scripts/fetch-engine.sh mac     # 或 win / linux,下载引擎二进制
npm start                            # 本地运行
npm run dist:mac                     # 打 dmg(产物在 desktop/release/)
npm run dist:win                     # 打 exe
```
CI:推一个 `v*` tag(或手动触发 [build workflow](.github/workflows/build.yml)),GitHub Actions 自动出 **dmg + exe** 并挂到 Release。

## 架构

```
桌面 app (Electron)  ──spawn──>  zju-connect 引擎  ──EasyConnect──>  remote.hkust-gz.edu.cn
   登录/开关/端口 UI              本地 SOCKS5 1080                       │
                                      │                                  └─ 校内 / HPC 10.120/16
   你的 ssh / app ──SOCKS──> 1080 ────┘
```
- 密码:UI → 系统安全区(safeStorage)→ 启动时写入 0600 临时 TOML 交给引擎,连接结束即删。
- 引擎按 平台/架构 命名打包(`zju-connect-darwin-arm64` 等),app 内置对应二进制,运行时自动选。

## Roadmap

- [x] 桌面 GUI(macOS dmg / Windows exe)— 登录 / 开关 / 端口
- [x] CLI + 开机自启
- [ ] **Android APK**(二期)— 用上游 gomobile AAR + `VpnService`,见 [`android/`](android/)
- [ ] 系统托盘 / 菜单栏快捷开关
- [ ] 引擎自动更新

## 安全与隐私

- 不收集任何数据;密码只存本机系统安全区,仅发往学校网关。
- 仓库**不含**任何账号密码。

## 致谢与许可

引擎:[Mythologyli/zju-connect](https://github.com/Mythologyli/zju-connect)(GPL‑3.0)。
本项目同样以 **GPL‑3.0** 发布(见 [LICENSE](LICENSE))。logo 为香港科技大学(广州)校徽,版权归学校所有,仅作本校工具标识用途。
