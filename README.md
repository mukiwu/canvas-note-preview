# Canvas Note Preview

A Heptabase-like note preview feature for Obsidian Canvas. When you click on a note node in Canvas, it automatically displays the note content in a sidebar panel.

## ✨ Features

- 🎯 **Automatic Preview**: Click any note node in Canvas to preview its content in the sidebar
- 📖 **Full Markdown Support**: Complete rendering of Markdown including images, links, embeds, and formatting
- 🖼️ **Image Support**: Properly displays embedded images with custom sizes (e.g., `![[image.png|500]]`)
- 🚀 **Quick Open**: One-click button to open the full note in the main editor
- 🎨 **Theme Integration**: Seamlessly adapts to your Obsidian theme
- ⚡ **Lightweight**: Minimal performance impact

## 📸 Demo

https://github.com/user-attachments/assets/demo.mp4

*Click on any note in Canvas to instantly preview its content in the sidebar*

## 🚀 Usage

1. Enable the plugin in Obsidian Settings → Community Plugins
2. Open any Canvas file
3. Click on a note node in the Canvas
4. The note preview will automatically appear in the right sidebar

You can also manually open the preview panel using the Command Palette (`Cmd/Ctrl + P`) and searching for "Open Note Preview Panel".

## 📥 Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Canvas Note Preview"
4. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json` from the [latest release](https://github.com/mukiwu/canvas-note-preview/releases)
2. Create a folder named `canvas-note-preview` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin in Settings

## 🛠️ Development

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/mukiwu/canvas-note-preview.git

# Install dependencies
npm install

# Start development mode (auto-rebuild on changes)
npm run dev

# Build for production
npm run build
```

### Testing

1. Create a symbolic link from your development folder to your test vault's plugin folder:
   ```bash
   ln -s /path/to/canvas-note-preview /path/to/vault/.obsidian/plugins/canvas-note-preview
   ```
2. Reload Obsidian (`Cmd/Ctrl + R`)
3. Enable the plugin in Settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 💬 Support

If you encounter any issues or have feature requests, please [open an issue](https://github.com/mukiwu/canvas-note-preview/issues) on GitHub.

## 🙏 Acknowledgments

Inspired by [Heptabase](https://heptabase.com/)'s intuitive note preview feature.

---

If you find this plugin helpful, consider giving it a ⭐ on GitHub!
