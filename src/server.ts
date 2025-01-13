import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import bytes from 'bytes';

// Load configuration
interface Config {
  server: {
    port: number;
    host: string;
  };
  fileManager: {
    allowedFolders: {
      name: string;
      path: string;
      description: string;
    }[];
    fileTypes: {
      text: string[];
      code: string[];
      image: string[];
      pdf: string[];
    };
  };
}

function loadConfig(): Config {
  try {
    const configFile = fs.readFileSync('config.yml', 'utf8');
    const config = yaml.load(configFile) as Config;
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }
}

const config = loadConfig();
const port = config.server.port || 3000;

const app = express();

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File type helpers
const previewableExtensions = {
  text: config.fileManager.fileTypes.text,
  image: config.fileManager.fileTypes.image,
  pdf: config.fileManager.fileTypes.pdf,
  code: config.fileManager.fileTypes.code
};

function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (previewableExtensions.text.includes(ext)) return 'text';
  if (previewableExtensions.image.includes(ext)) return 'image';
  if (previewableExtensions.pdf.includes(ext)) return 'pdf';
  if (previewableExtensions.code.includes(ext)) return 'code';
  return 'other';
}

// Parse and resolve allowed folders
const allowedFolders = config.fileManager.allowedFolders.map(folder => {
  if (folder.path.startsWith('./')) {
    return path.resolve(process.cwd(), folder.path.slice(2));
  }
  return path.resolve(folder.path);
});

console.log('Resolved allowed folders:', allowedFolders);

// Helper function to check if path is within allowed folders
function isPathAllowed(checkPath: string): boolean {
  const resolvedPath = path.resolve(checkPath);
  console.log('Checking path:', resolvedPath);
  
  return allowedFolders.some(folder => {
    const relative = path.relative(folder, resolvedPath);
    const isAllowed = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    console.log(`Checking against folder: ${folder}`);
    console.log(`Relative path: ${relative}`);
    console.log(`Is allowed: ${isAllowed}`);
    return isAllowed;
  }) || allowedFolders.includes(resolvedPath);
}

// Helper function to generate unique filename
function getUniqueFilename(directory: string, originalName: string): string {
  let filename = originalName;
  let counter = 1;
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);

  while (fs.existsSync(path.join(directory, filename))) {
    counter++;
    filename = `${nameWithoutExt} (${counter})${ext}`;
  }

  return filename;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const currentPath = decodeURIComponent(req.body.currentPath || '');
    const resolvedPath = path.resolve(currentPath);
    
    if (!currentPath || !isPathAllowed(resolvedPath)) {
      cb(new Error('Invalid upload location'), '');
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
    cb(null, resolvedPath);
  },
  filename: (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const currentPath = decodeURIComponent(req.body.currentPath || '');
    const resolvedPath = path.resolve(currentPath);
    const uniqueFilename = getUniqueFilename(resolvedPath, file.originalname);
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage });

interface FileItem {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  isDirectory: boolean;
  modified: Date;
  type: string;
}

// Helper function to format bytes safely
function formatBytes(size: number): string {
  const formatted = bytes(size);
  return formatted || '0 B';
}

// Routes
app.get('/', (req: Request, res: Response) => {
  const requestedPath = req.query.path as string;
  const currentPath = requestedPath ? 
    decodeURIComponent(requestedPath) : 
    null;

  console.log('Requested path:', currentPath);
  
  // If no path is specified, render the root view
  if (!currentPath) {
    res.render('index', { 
      currentPath: null,
      items: [],
      allowedFolders,
      config,
      path // Pass the path module to the template
    });
    return;
  }

  // Security check: ensure we're within allowed folders
  if (!isPathAllowed(currentPath)) {
    console.log('Access denied for path:', currentPath);
    res.status(403).send('Access denied. Path: ' + currentPath);
    return;
  }

  const resolvedPath = path.resolve(currentPath);

  // Check if folder exists
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    console.log('Folder not found:', resolvedPath);
    res.status(404).render('404', {
      path: currentPath,
      config,
      allowedFolders
    });
    return;
  }

  const items: FileItem[] = [];
  const parentPath = path.dirname(resolvedPath);

  // Add parent directory link if we're in a subfolder
  if (isPathAllowed(parentPath) && !allowedFolders.includes(resolvedPath)) {
    items.push({
      name: '..',
      path: encodeURIComponent(parentPath),
      size: 0,
      sizeFormatted: formatBytes(0),
      isDirectory: true,
      modified: new Date(),
      type: 'directory'
    });
  }

  // Read current directory
  if (fs.existsSync(resolvedPath)) {
    fs.readdirSync(resolvedPath).forEach((item: string) => {
      const fullPath = path.join(resolvedPath, item);
      const stats = fs.statSync(fullPath);
      
      items.push({
        name: item,
        path: encodeURIComponent(fullPath),
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        isDirectory: stats.isDirectory(),
        modified: stats.mtime,
        type: stats.isDirectory() ? 'directory' : getFileType(item)
      });
    });
  }

  // Sort: directories first, then files
  items.sort((a, b) => {
    if (a.name === '..') return -1;
    if (b.name === '..') return 1;
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  res.render('index', { 
    items, 
    currentPath: resolvedPath,
    allowedFolders,
    config,
    path // Pass the path module to the template
  });
});

// Handle file upload
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  const currentPath = req.body.currentPath;
  
  if (!currentPath) {
    res.status(400).send('No target folder specified');
    return;
  }

  const resolvedPath = path.resolve(decodeURIComponent(currentPath));

  // Check if folder exists
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    res.status(404).render('404', {
      path: currentPath,
      config,
      allowedFolders
    });
    return;
  }

  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  res.redirect(`/?path=${encodeURIComponent(currentPath)}`);
});

// Handle file download
app.get('/download/:filename(*)', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const resolvedPath = path.resolve(filename);
  
  if (!isPathAllowed(resolvedPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    res.download(resolvedPath);
    return;
  }

  res.status(404).send('File not found');
});

// Delete file or directory
app.post('/delete/:path(*)', (req: Request, res: Response) => {
  const itemPath = decodeURIComponent(req.params.path);
  const resolvedPath = path.resolve(itemPath);
  
  if (!isPathAllowed(resolvedPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (fs.existsSync(resolvedPath)) {
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      fs.rmdirSync(resolvedPath, { recursive: true });
    } else {
      fs.unlinkSync(resolvedPath);
    }
    const parentPath = path.dirname(resolvedPath);
    res.redirect(`/?path=${encodeURIComponent(parentPath)}`);
    return;
  }

  res.status(404).send('Path not found');
});

// Create new folder
app.post('/create-folder', (req: Request, res: Response) => {
  const { currentPath, folderName } = req.body;
  const resolvedCurrentPath = path.resolve(decodeURIComponent(currentPath));

  // Check if parent folder exists
  if (!fs.existsSync(resolvedCurrentPath) || !fs.statSync(resolvedCurrentPath).isDirectory()) {
    res.status(404).render('404', {
      path: currentPath,
      config,
      allowedFolders
    });
    return;
  }

  const newFolderPath = path.join(resolvedCurrentPath, folderName);

  if (!isPathAllowed(newFolderPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (!fs.existsSync(newFolderPath)) {
    fs.mkdirSync(newFolderPath, { recursive: true });
  }

  res.redirect(`/?path=${encodeURIComponent(resolvedCurrentPath)}`);
});

// Preview route
app.get('/preview/:filename(*)', async (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const resolvedPath = path.resolve(filename);
  
  if (!isPathAllowed(resolvedPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).send('File not found');
    return;
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    res.status(400).send('Not a file');
    return;
  }

  const fileType = getFileType(resolvedPath);
  const fileContent = fileType === 'text' || fileType === 'code' ? 
    fs.readFileSync(resolvedPath, 'utf-8') : null;
  
  res.render('preview', {
    filename: path.basename(resolvedPath),
    fileType,
    filePath: encodeURIComponent(resolvedPath),
    fileContent,
    currentPath: path.dirname(resolvedPath),
    path
  });
});

// Image preview route
app.get('/preview-image/:filename(*)', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const resolvedPath = path.resolve(filename);
  
  if (!isPathAllowed(resolvedPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (fs.existsSync(resolvedPath) && getFileType(resolvedPath) === 'image') {
    res.sendFile(resolvedPath);
    return;
  }

  res.status(404).send('Image not found');
});

// PDF preview route
app.get('/preview-pdf/:filename(*)', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const resolvedPath = path.resolve(filename);
  
  if (!isPathAllowed(resolvedPath)) {
    res.status(403).send('Access denied');
    return;
  }

  if (fs.existsSync(resolvedPath) && getFileType(resolvedPath) === 'pdf') {
    res.sendFile(resolvedPath);
    return;
  }

  res.status(404).send('PDF not found');
});

app.listen(port, config.server.host, () => {
  console.log(`Server running at http://${config.server.host}:${port}`);
  console.log('Allowed folders:', config.fileManager.allowedFolders);
}); 