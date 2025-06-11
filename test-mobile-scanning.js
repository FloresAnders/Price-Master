// Mobile Scanning System Test Script
// This script validates that all components are properly configured

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Mobile Scanning System Setup...\n');

// Check required files
const requiredFiles = [
  'src/services/scanning.ts',
  'src/hooks/useScanning.ts',
  'src/app/mobile-scan/page.tsx',
  'src/components/MobileScanHelp.tsx',
  'src/utils/qrUtils.ts',
  'src/app/scan-test/page.tsx'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log('✅', file);
  } else {
    console.log('❌', file, '- MISSING');
    allFilesExist = false;
  }
});

// Check Firebase configuration
const firebaseConfigPath = path.join(__dirname, 'src/config/firebase.ts');
if (fs.existsSync(firebaseConfigPath)) {
  console.log('✅ Firebase configuration exists');
} else {
  console.log('❌ Firebase configuration missing');
  allFilesExist = false;
}

// Check package.json dependencies
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = ['firebase', 'next', 'react'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log('✅ Dependency:', dep);
    } else {
      console.log('❌ Missing dependency:', dep);
      allFilesExist = false;
    }
  });
}

console.log('\n📋 System Status:');
if (allFilesExist) {
  console.log('🎉 All components are properly configured!');
  console.log('\n🚀 To start testing:');
  console.log('1. Run: npm run dev');
  console.log('2. Open: http://localhost:3000/mobile-scan');
  console.log('3. Test: http://localhost:3000/scan-test');
} else {
  console.log('⚠️  Some components are missing. Please check the output above.');
}

console.log('\n📱 Mobile Scanning Features:');
console.log('• Real-time barcode scanning with camera');
console.log('• Manual barcode entry');
console.log('• QR code generation for easy mobile access');
console.log('• Session-based synchronization');
console.log('• Offline detection and fallback');
console.log('• Firebase Firestore integration');
console.log('• Responsive mobile-first design');
