# PixelDungeon — 2D Roguelike Game

Phaser 3 + TypeScript + Vite

## 可用 Skills

使用 Skill 工具加载 skills。关键 skills：

- /using-superpowers — 每次 session 开始时加载，建立 skill 使用规范
- /writing-plans — 规划新功能时使用
- /executing-plans — 执行计划时使用
- /systematic-debugging — 修复 bug 时使用
- /verification-before-completion — 完成任务前验证
- /brainstorming — 设计决策时使用
- /test-driven-development — 写测试时使用

## 工作流

1. 从 ralph.sh 获取任务
2. 如有适合的 skill，先用 Skill 工具加载
3. 完成任务代码
4. tsc --noEmit + npm run build 验证
5. ralph.sh done + git commit + push
