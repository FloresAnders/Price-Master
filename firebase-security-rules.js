// Firebase Security Rules for Mobile Scanning System
// Add these rules to your Firebase Console -> Firestore Database -> Rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules for other collections
    match /locations/{document} {
      allow read, write: if true; // Adjust as needed
    }
    
    match /sorteos/{document} {
      allow read, write: if true; // Adjust as needed
    }
    
    match /users/{document} {
      allow read, write: if true; // Adjust as needed
    }
    
    // NEW: Rules for mobile scanning system
    match /scans/{document} {
      allow read, write: if true; // Allow all operations for now
      // For production, consider more restrictive rules like:
      // allow read, write: if request.auth != null;
      // allow read: if resource.data.sessionId == request.auth.uid;
    }
    
    // Allow real-time listeners for scanning
    match /scans/{scanId} {
      allow read, create, update: if true;
      allow delete: if true; // For cleanup operations
    }
  }
}

/*
PRODUCTION SECURITY RECOMMENDATIONS:

1. User Authentication:
   match /scans/{document} {
     allow read, write: if request.auth != null;
   }

2. Session-based Access:
   match /scans/{document} {
     allow read: if resource.data.sessionId == request.auth.uid;
     allow write: if request.auth != null;
   }

3. Time-based Cleanup:
   match /scans/{document} {
     allow delete: if request.auth != null && 
       resource.data.timestamp < timestamp.date(2025, 6, 1); // Cleanup old scans
   }

4. Rate Limiting:
   Use Firebase App Check and implement rate limiting in your app
*/
