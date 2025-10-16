const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function buildForCapacitor() {
  console.log('Building for Capacitor...');
  
  // 0. Check environment variables
  console.log('Checking environment variables...');
  const envPath = path.join('.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('.env.local not found. Firebase may not work correctly.');
    console.log('Please create .env.local with your Firebase configuration');
  } else {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('your-api-key-here') || envContent.includes('your-project')) {
      console.warn('.env.local contains placeholder values. Update with real Firebase config.');
    } else {
      console.log('Environment variables configured');
    }
  }
  
  // 1. Remove dynamic route if it exists (no longer needed - using not-found.tsx for redirects)
  const dynamicRoutePath = path.join('src', 'app', 'mobile-scan', '[code]');
  
  if (fs.existsSync(dynamicRoutePath)) {
    console.log('Removing old dynamic route...');
    fs.rmSync(dynamicRoutePath, { recursive: true, force: true });
  }
  
  try {
    // 2. Clean previous builds
    console.log('Cleaning previous builds...');
    if (fs.existsSync('out')) {
      fs.rmSync('out', { recursive: true, force: true });
    }
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
    }
    
    // 3. Run Next.js build
    console.log('Building Next.js app...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // 4. Create fallback for dynamic routes (simple redirect)
    console.log('Creating fallback for dynamic routes...');
    const fallbackHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
        // Simple client-side routing for mobile-scan/[code]
        if (window.location.pathname.includes('/mobile-scan/')) {
            const code = window.location.pathname.split('/mobile-scan/')[1];
            if (code && code !== '') {
                window.location.href = '/mobile-scan/?code=' + encodeURIComponent(code);
            } else {
                window.location.href = '/mobile-scan/';
            }
        }
    </script>
</head>
<body>
    <div style="text-align: center; padding: 50px;">
        <h2>Redirecting...</h2>
        <p>Please wait while we redirect you.</p>
    </div>
</body>
</html>
`;
    
    // Create mobile-scan directory structure in out
    const mobileScanOutDir = path.join('out', 'mobile-scan');
    if (!fs.existsSync(mobileScanOutDir)) {
      fs.mkdirSync(mobileScanOutDir, { recursive: true });
    }
    
    // Write fallback file
    fs.writeFileSync(path.join(mobileScanOutDir, 'fallback.html'), fallbackHTML);

    console.log('Build completed successfully!');

  } catch (error) {
    console.error('Build failed:', error.message);
    throw error;
  }
  // Note: No longer restoring dynamic route - using not-found.tsx for redirects instead
}

// Run the build
buildForCapacitor().catch(console.error);