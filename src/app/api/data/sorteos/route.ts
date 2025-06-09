// src/app/api/data/sorteos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

const SORTEOS_FILE = path.join(process.cwd(), 'src', 'data', 'sorteos.json');

export async function GET() {
  try {
    const data = await readFile(SORTEOS_FILE, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading sorteos file:', error);
    return NextResponse.json({ error: 'Failed to read sorteos data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Los datos pueden venir como array de objetos Sorteo o como array de strings
    // Si vienen como objetos, extraer solo los nombres para mantener compatibilidad
    let processedData;
    
    if (Array.isArray(data) && data.length > 0) {
      if (typeof data[0] === 'string') {
        // Ya es un array de strings
        processedData = data;
      } else if (data[0].name !== undefined) {
        // Es un array de objetos Sorteo, extraer los nombres
        processedData = data.map((sorteo: any) => sorteo.name).filter((name: string) => name.trim() !== '');
      } else {
        return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }
    
    // Escribir el archivo JSON manteniendo el formato original (array de strings)
    await writeFile(SORTEOS_FILE, JSON.stringify(processedData, null, 4), 'utf8');
    
    return NextResponse.json({ success: true, message: 'Sorteos updated successfully' });
  } catch (error) {
    console.error('Error writing sorteos file:', error);
    return NextResponse.json({ error: 'Failed to update sorteos data' }, { status: 500 });
  }
}
