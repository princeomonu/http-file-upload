# FileVault 📁

A simple # FileVault 📁
file management app built with Express and TypeScript.

## Features ✨

- 🚀 Modern web interface with Tailwind CSS
- 📂 Configurable allowed folders via YAML configuration
- 🔍 File preview support
  - Text files and source code
  - Images
  - PDFs
  - Markdown files
- 📊 Human-readable file size formatting
- 🗂️ Traditional file manager interface with folder navigation
- 🔄 Smart file handling with timestamp-based naming for duplicates
- 🔒 Path traversal protection
- 📱 Responsive design with sidebar navigation
- 📁 Create new folders within allowed directories
- ❌ Delete files and folders (with proper permissions)

## Tech Stack 🛠

- Backend:
  - Node.js + Express
  - TypeScript
  - Multer for file uploads
  - EJS templating
  - js-yaml for configuration
- Frontend:
  - Tailwind CSS

## Setup 🚀

1. Clone the repository:
```bash
git clone https://github.com/yourusername/filevault.git
cd filevault
```

2. Install dependencies:
```bash
yarn install
```

3. Configure your folders in `config.yml`:
```yaml
port: 3000  # Server port number
allowedFolders:
  - "./test folder"  # Example folder path
```

4. Start the server:
```bash
# Development with auto-reload
yarn dev

# Production
yarn start
```

5. Visit `http://localhost:3000` in your browser

## Configuration 🔧

The `config.yml` file controls server settings and allowed folders:

```yaml
# Server configuration
port: 3000

# List of allowed folders to manage
allowedFolders:
  - "./test folder"
  - "/path/to/another/folder"
```

## Security 🔐

- Path traversal protection through strict path validation
- Access limited to configured allowed folders only
- Secure file operations with proper permission checks
- Error handling for non-existent folders and invalid operations

## Development 👨‍💻

```bash
# Run with hot reload
yarn dev

# Run in production mode
yarn start

# Build TypeScript
yarn build
```

## Contributing 🤝

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 
