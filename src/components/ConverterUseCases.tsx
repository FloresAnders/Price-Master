export default function ConverterUseCases() {
    return (
        <div className="mt-6 bg-purple-50 rounded-lg p-4">
            <h3 className="font-medium text-purple-800 mb-2">🔧 Casos de uso comunes:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-700">
                <div>
                    <p><strong>Para programadores:</strong></p>
                    <ul className="ml-4 space-y-1">
                        <li>• camelCase para variables</li>
                        <li>• snake_case para Python</li>
                        <li>• kebab-case para CSS</li>
                    </ul>
                </div>
                <div>
                    <p><strong>Para documentos:</strong></p>
                    <ul className="ml-4 space-y-1">
                        <li>• Títulos profesionales</li>
                        <li>• Conversión de mayúsculas/minúsculas</li>
                        <li>• Análisis de texto con estadísticas</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
