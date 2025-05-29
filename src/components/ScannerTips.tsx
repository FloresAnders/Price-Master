export default function ScannerTips() {
    return (
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">💡 Consejos para mejores resultados:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
                <li>• Asegúrate de que el código de barras esté bien iluminado</li>
                <li>• La imagen debe estar enfocada y sin borrosidad</li>
                <li>• Puedes pegar imágenes directamente con Ctrl+V</li>
                <li>• Soporta múltiples formatos: EAN-13, Code-128, QR, UPC-A</li>
            </ul>
        </div>
    );
}
