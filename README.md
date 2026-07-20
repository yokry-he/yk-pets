# YK-PETS Browser Agent

YK-PETS 是一个住在网页中的 3D AI 前端工程伙伴平台。当前默认宠物的**物种是云狐（Cloud Fox）**，名字是**云灵（Zeph）**。

YK-PETS is an in-page 3D AI frontend engineering companion platform. The current default pet is a **Cloud Fox** named **Zeph**（云灵）.

请选择文档语言 / Choose a documentation language:

- [简体中文](./README.zh-CN.md)
- [English](./README.en.md)

设计、架构、协议、安全和开发文档索引：
Design, architecture, protocol, security, and development documentation index:

- [Documentation index / 文档索引](./docs/README.md)

## Identity model / 身份模型

YK-PETS separates three concepts so future pets can be added without renaming the product:

```text
Product / 产品品牌: YK-PETS
Species / 宠物物种: Cloud Fox / 云狐
Pet name / 宠物名字: Zeph / 云灵
```

The `v0.6.10` migration keeps legacy `Nova*`, `NOVA_*`, `@nova/*`, and `nova:*` technical identifiers only where compatibility is required. User-facing branding, the primary CLI, and new domain contracts use YK-PETS.
