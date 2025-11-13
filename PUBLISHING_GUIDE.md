# Obsidian Plugin 上架指南

這份文件將引導你如何將 Canvas Note Preview plugin 上架到 Obsidian 社群插件市場。

## 📋 前置準備清單

- [ ] GitHub 帳號
- [ ] Plugin 已在本地測試完成
- [ ] 準備好 plugin 的截圖或 GIF 演示

## 🚀 上架步驟

### 步驟 1：創建 GitHub 倉庫

1. **登入 GitHub** 並創建一個新的公開倉庫
   - 倉庫名稱：`canvas-note-preview`（或你喜歡的名稱）
   - 設為 **Public**（必須是公開的）
   - 不需要初始化 README（我們已經有了）

2. **將 plugin 代碼推送到 GitHub**

   在你的 plugin 目錄中執行：
   ```bash
   cd .obsidian/plugins/canvas-note-preview

   # 初始化 git（如果還沒有）
   git init

   # 添加所有檔案
   git add .

   # 創建第一個 commit
   git commit -m "Initial commit: Canvas Note Preview plugin"

   # 連結到你的 GitHub 倉庫
   git remote add origin https://github.com/YOUR_USERNAME/canvas-note-preview.git

   # 推送代碼
   git branch -M main
   git push -u origin main
   ```

### 步驟 2：創建第一個 Release

1. **建置 plugin**
   ```bash
   npm run build
   ```
   確保 `main.js` 已經生成

2. **在 GitHub 上創建 Release**

   方法 A：使用 GitHub 網頁介面
   - 進入你的倉庫
   - 點擊右側的 "Releases"
   - 點擊 "Create a new release"
   - Tag version: `1.0.0`
   - Release title: `1.0.0`
   - 描述你的 plugin 功能和更新內容
   - 上傳這些檔案：
     - `main.js`
     - `manifest.json`
     - `styles.css`（如果有的話）
   - 點擊 "Publish release"

   方法 B：使用 Git 標籤（推薦）
   ```bash
   # 創建標籤
   git tag -a 1.0.0 -m "Release version 1.0.0"

   # 推送標籤
   git push origin 1.0.0
   ```
   然後 GitHub Actions 會自動創建 release（如果你設置了 workflow）

3. **確認 Release 包含必要檔案**
   - `main.js` ✓
   - `manifest.json` ✓

### 步驟 3：提交到 Obsidian 插件市場

1. **Fork obsidian-releases 倉庫**
   - 前往：https://github.com/obsidianmd/obsidian-releases
   - 點擊右上角的 "Fork" 按鈕

2. **添加你的 plugin 資訊**

   在 fork 的倉庫中：

   a. 編輯 `community-plugins.json`
   在檔案末尾添加（記得保持 JSON 格式）：
   ```json
   {
     "id": "canvas-note-preview",
     "name": "Canvas Note Preview",
     "author": "YOUR_NAME",
     "description": "Preview notes in sidebar when clicking canvas nodes, similar to Heptabase",
     "repo": "YOUR_USERNAME/canvas-note-preview"
   }
   ```

3. **創建 Pull Request**
   - Commit 你的更改
   - 前往你 fork 的倉庫
   - 點擊 "Pull requests" → "New pull request"
   - 標題：`Add canvas-note-preview plugin`
   - 描述：簡單說明你的 plugin 功能
   - 提交 PR

### 步驟 4：等待審核

1. **審核過程**
   - Obsidian 團隊會審核你的 plugin
   - 通常需要幾天到幾週
   - 他們可能會要求修改或改進

2. **審核標準**
   - 代碼品質和安全性
   - 功能是否正常運作
   - 是否遵循 Obsidian 的 API 規範
   - README 是否清晰完整

3. **審核通過後**
   - 你的 plugin 會出現在 Obsidian 社群插件列表中
   - 用戶可以直接在 Obsidian 中搜索並安裝

## 📝 重要提醒

### manifest.json 必須包含的欄位
```json
{
  "id": "canvas-note-preview",
  "name": "Canvas Note Preview",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Preview notes in sidebar when clicking canvas nodes, similar to Heptabase",
  "author": "YOUR_NAME",
  "authorUrl": "https://github.com/YOUR_USERNAME",
  "isDesktopOnly": false
}
```

### README.md 應該包含
- ✅ 清晰的功能說明
- ✅ 使用截圖或 GIF
- ✅ 安裝步驟
- ✅ 使用說明
- ✅ 授權資訊

### 版本更新流程
當你想發布新版本時：
1. 更新 `manifest.json` 中的 `version`
2. 更新 `versions.json`
3. 建置：`npm run build`
4. 創建新的 git tag：`git tag -a 1.0.1 -m "Release 1.0.1"`
5. 推送：`git push origin 1.0.1`
6. 在 GitHub 創建新的 Release

## 🎯 上架前檢查清單

在提交 PR 之前，請確認：

- [ ] Plugin 在你的 Obsidian 中正常運作
- [ ] `manifest.json` 所有必填欄位都已填寫
- [ ] `README.md` 內容完整且清晰
- [ ] 已創建 GitHub Release（包含 `main.js` 和 `manifest.json`）
- [ ] 代碼品質良好，沒有明顯的 bug
- [ ] 授權檔案（LICENSE）已包含
- [ ] 更新 README 中的 GitHub URL（將 YOUR_USERNAME 替換為你的 GitHub 用戶名）

## 🔗 有用的連結

- Obsidian Plugin 開發文檔：https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- Obsidian Sample Plugin：https://github.com/obsidianmd/obsidian-sample-plugin
- 社群插件列表：https://github.com/obsidianmd/obsidian-releases
- Obsidian Discord：https://discord.gg/obsidianmd

## 💡 提示

1. **準備好截圖/GIF**：一個好的演示能大大增加用戶的興趣
2. **詳細的 README**：清楚說明如何使用你的 plugin
3. **快速回應**：如果審核者有問題，盡快回覆
4. **持續維護**：定期更新和修復 bug 會讓用戶更信任你的 plugin

## 🎉 完成！

恭喜！完成以上步驟後，你的 plugin 就在上架的路上了。祝你好運！
