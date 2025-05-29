export default function CalculatorInfo() {
    return (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">🇨🇷 Para Costa Rica:</h3>
                <p className="text-sm text-green-700">
                    IVA configurado al 13% por defecto. Puedes cambiarlo según tus necesidades.
                </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">💰 Cálculo inteligente:</h3>
                <p className="text-sm text-yellow-700">
                    El descuento se aplica primero, luego se calcula el impuesto sobre el precio con descuento.
                </p>
            </div>
        </div>
    );
}