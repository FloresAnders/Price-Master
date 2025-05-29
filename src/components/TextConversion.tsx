'use client';
import React, { useState } from 'react';

export default function TextConversion() {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-lg shadow">
      <label className="font-medium text-gray-700">Text to Convert</label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="form-input w-full rounded-md border-gray-300 focus:border-indigo-500"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setText(text.toUpperCase())}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          To Uppercase
        </button>
        <button
          onClick={() => setText(text.toLowerCase())}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          To Lowercase
        </button>
      </div>
    </div>
  );
}