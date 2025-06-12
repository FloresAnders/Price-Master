// app/edit/page.tsx
'use client'

import React from 'react'
import DataEditor from '@/edit/DataEditor'

export default function EditPage() {
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DataEditor />
    </main>
  )
}
