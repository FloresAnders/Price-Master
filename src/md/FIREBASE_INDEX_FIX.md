# Firebase Firestore Index Creation Guide

## 🔥 Index Error Resolution

### Issue
The Firebase query requires composite indexes for the 'scans' collection when filtering by multiple fields and ordering.

### Required Indexes

#### 1. Index for Unprocessed Scans Query
**Fields**: `processed` (Ascending) → `timestamp` (Descending)
**Query**: `where('processed', '==', false).orderBy('timestamp', 'desc')`

#### 2. Index for Session-based Scans Query  
**Fields**: `processed` (Ascending) → `sessionId` (Ascending) → `timestamp` (Descending)
**Query**: `where('processed', '==', false).where('sessionId', '==', sessionId).orderBy('timestamp', 'desc')`

#### 3. Index for Cleanup Query
**Fields**: `processed` (Ascending) → `timestamp` (Ascending)
**Query**: `where('processed', '==', true).where('timestamp', '<', cutoffDate)`

## ⚡ Quick Fix Options

### Option 1: Create Indexes via Firebase Console (Recommended)
1. Click the provided link: https://console.firebase.google.com/v1/r/project/pricemaster-4a611/firestore/indexes?create_composite=...
2. Firebase will automatically create the required index
3. Wait 2-5 minutes for index creation to complete

### Option 2: Create Indexes Manually
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection ID: `scans`
4. Add the following fields:

**Index 1:**
- Field: `processed`, Order: Ascending
- Field: `timestamp`, Order: Descending

**Index 2:**  
- Field: `processed`, Order: Ascending
- Field: `sessionId`, Order: Ascending
- Field: `timestamp`, Order: Descending

**Index 3:**
- Field: `processed`, Order: Ascending  
- Field: `timestamp`, Order: Ascending

### Option 3: Use Firebase CLI (Advanced)
```bash
# Create firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "scans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "processed", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "scans", 
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "processed", "order": "ASCENDING" },
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "scans",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "processed", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "ASCENDING" }
      ]
    }
  ]
}

# Deploy indexes
firebase deploy --only firestore:indexes
```

## 🎯 Testing After Index Creation

1. Wait 2-5 minutes for indexes to build
2. Refresh your application
3. Test the mobile scanning functionality
4. Verify real-time synchronization works

## 🚀 Status

- ✅ Index requirements identified
- ✅ Multiple creation options provided  
- ⏳ Waiting for index creation
- ⏳ System testing after indexes are ready

**Next Step**: Click the Firebase Console link and create the required indexes!
