// src/app/api/data/locations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

const LOCATIONS_FILE = path.join(process.cwd(), 'src', 'data', 'locations.json');

export async function GET() {
  try {
    const data = await readFile(LOCATIONS_FILE, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading locations file:', error);
    return NextResponse.json({ error: 'Failed to read locations data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validar estructura de datos
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }
    
    // Escribir el archivo JSON
    await writeFile(LOCATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, message: 'Locations updated successfully' });
  } catch (error) {
    console.error('Error writing locations file:', error);
    return NextResponse.json({ error: 'Failed to update locations data' }, { status: 500 });
  }
}
